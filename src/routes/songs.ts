import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Adicionar música à playlist
router.post('/:playlistId/songs', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { spotify_track_id, track_name, artist_name, track_duration_ms, priority } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar permissão
    const membership = await db.get(
      'SELECT role, is_banned FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || membership.is_banned) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Verificar limite de músicas por usuário
    const playlist = await db.get('SELECT max_songs_per_user FROM playlists WHERE id = ?', playlistId);
    
    if (playlist?.max_songs_per_user) {
      const userSongCount = await db.get(
        'SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ? AND added_by = ? AND is_banned = 0',
        [playlistId, userId]
      );

      if (userSongCount?.count >= playlist.max_songs_per_user) {
        res.status(400).json({
          error: `Limit reached: max ${playlist.max_songs_per_user} songs per user`
        });
        return;
      }
    }

    const result = await db.run(
      `INSERT INTO playlist_songs 
       (playlist_id, spotify_track_id, track_name, artist_name, track_duration_ms, added_by, priority) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [playlistId, spotify_track_id, track_name, artist_name, track_duration_ms || 0, userId, priority || 0]
    );

    const song = await db.get(
      'SELECT * FROM playlist_songs WHERE id = ?',
      result.lastID
    );

    res.status(201).json({
      message: 'Song added successfully',
      song
    });
  } catch (error) {
    console.error('Error adding song:', error);
    res.status(500).json({ error: 'Failed to add song' });
  }
});

// Remover música (moderator/admin)
router.delete('/:playlistId/songs/:songId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, songId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only moderators and admins can remove songs' });
      return;
    }

    const song = await db.get(
      'SELECT added_by FROM playlist_songs WHERE id = ? AND playlist_id = ?',
      [songId, playlistId]
    );

    if (!song) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }

    const reason = req.body?.reason || 'Removed by moderator';

    await db.run('DELETE FROM playlist_songs WHERE id = ?', songId);

    await db.run(
      'INSERT INTO song_removal_history (playlist_id, song_id, removed_by, reason) VALUES (?, ?, ?, ?)',
      [playlistId, songId, userId, reason]
    );

    res.json({ message: 'Song removed successfully' });
  } catch (error) {
    console.error('Error removing song:', error);
    res.status(500).json({ error: 'Failed to remove song' });
  }
});

// Atualizar prioridade de música
router.patch('/:playlistId/songs/:songId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, songId } = req.params;
    const { priority } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    const song = await db.get(
      'SELECT added_by FROM playlist_songs WHERE id = ? AND playlist_id = ?',
      [songId, playlistId]
    );

    if (!song) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }

    if (song.added_by !== userId) {
      res.status(403).json({ error: 'Only song uploader can change priority' });
      return;
    }

    await db.run(
      'UPDATE playlist_songs SET priority = ? WHERE id = ?',
      [priority || 0, songId]
    );

    const updated = await db.get('SELECT * FROM playlist_songs WHERE id = ?', songId);

    res.json({
      message: 'Priority updated successfully',
      song: updated
    });
  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

// Recalcular fila (sortear músicas - uma de cada usuário)
router.post('/:playlistId/shuffle-queue', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only moderators and admins can shuffle queue' });
      return;
    }

    // Obter todas as músicas não banidas
    const songs = await db.all(
      `SELECT ps.*, u.id as user_id
       FROM playlist_songs ps
       JOIN users u ON ps.added_by = u.id
       WHERE ps.playlist_id = ? AND ps.is_banned = 0
       ORDER BY ps.priority DESC, RANDOM()`,
      playlistId
    );

    // Agrupar por usuário
    const songsByUser: { [key: number]: typeof songs } = {};
    songs.forEach(song => {
      if (!songsByUser[song.user_id]) {
        songsByUser[song.user_id] = [];
      }
      songsByUser[song.user_id].push(song);
    });

    // Criar fila: uma música de cada usuário
    const queue: typeof songs = [];
    let hasMore = true;

    while (hasMore) {
      hasMore = false;
      for (const userId in songsByUser) {
        if (songsByUser[userId].length > 0) {
          queue.push(songsByUser[userId].shift()!);
          hasMore = true;
        }
      }
    }

    // Atualizar position_in_queue
    for (let i = 0; i < queue.length; i++) {
      await db.run(
        'UPDATE playlist_songs SET position_in_queue = ? WHERE id = ?',
        [i + 1, queue[i].id]
      );
    }

    res.json({
      message: 'Queue shuffled successfully',
      queue: queue.map(s => ({ id: s.id, track_name: s.track_name, added_by: s.added_by }))
    });
  } catch (error) {
    console.error('Error shuffling queue:', error);
    res.status(500).json({ error: 'Failed to shuffle queue' });
  }
});

export default router;
