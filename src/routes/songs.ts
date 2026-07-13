import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import spotifyService from '../services/spotifyService';
import { io } from '../index';

const router = Router();

// Adicionar música
router.post('/:playlistId/songs', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { spotify_track_id, track_name, artist_name, track_duration_ms, priority } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar acesso
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Verificar limite
    const playlist = await db.get('SELECT max_songs_per_user FROM playlists WHERE id = ?', playlistId);
    
    if (playlist?.max_songs_per_user) {
      const count = await db.get(
        'SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ? AND added_by = ?',
        [playlistId, userId]
      );

      if (count?.count >= playlist.max_songs_per_user) {
        res.status(400).json({ error: 'Song limit reached' });
        return;
      }
    }

    const result = await db.run(
      `INSERT INTO playlist_songs 
       (playlist_id, spotify_track_id, track_name, artist_name, track_duration_ms, added_by, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [playlistId, spotify_track_id, track_name, artist_name, track_duration_ms || 0, userId, priority || 0]
    );

    const song = await db.get('SELECT * FROM playlist_songs WHERE id = ?', result.lastID);

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id, data) VALUES (?, ?, ?, ?)',
      [playlistId, 'song_added', userId, JSON.stringify({ track_name })]
    );

    // Notificar via WebSocket
    io?.to(`playlist:${playlistId}`).emit('song_added', {
      song,
      added_by_name: req.user?.email
    });

    res.status(201).json({ message: 'Song added', song });
  } catch (error) {
    console.error('Error adding song:', error);
    res.status(500).json({ error: 'Failed to add song' });
  }
});

// Remover música
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
      res.status(403).json({ error: 'Only moderators/admins can remove songs' });
      return;
    }

    const song = await db.get(
      'SELECT * FROM playlist_songs WHERE id = ? AND playlist_id = ?',
      [songId, playlistId]
    );

    if (!song) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }

    await db.run('DELETE FROM playlist_songs WHERE id = ?', songId);

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id, data) VALUES (?, ?, ?, ?)',
      [playlistId, 'song_removed', userId, JSON.stringify({ track_name: song.track_name })]
    );

    // Notificar via WebSocket
    io?.to(`playlist:${playlistId}`).emit('song_removed', { song_id: songId });

    res.json({ message: 'Song removed' });
  } catch (error) {
    console.error('Error removing song:', error);
    res.status(500).json({ error: 'Failed to remove song' });
  }
});

// Atualizar prioridade
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
      res.status(403).json({ error: 'Only uploader can change priority' });
      return;
    }

    await db.run(
      'UPDATE playlist_songs SET priority = ? WHERE id = ?',
      [priority || 0, songId]
    );

    // Notificar
    io?.to(`playlist:${playlistId}`).emit('song_updated', {
      song_id: songId,
      priority
    });

    res.json({ message: 'Priority updated' });
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

export default router;
