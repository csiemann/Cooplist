import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import spotifyService from '../services/spotifyService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface CreatePlaylistRequest {
  name: string;
  description?: string;
  max_songs_per_user?: number;
  duration_hours?: number;
}

// Criar playlist
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, max_songs_per_user, duration_hours } = req.body as CreatePlaylistRequest;
    const userId = req.user?.userId;
    const db = getDatabase();

    if (!name) {
      res.status(400).json({ error: 'Playlist name is required' });
      return;
    }

    // Criar no Spotify
    const spotifyPlaylist = await spotifyService.createPlaylist(
      name,
      description || ''
    );

    // Salvar no BD
    const result = await db.run(
      `INSERT INTO playlists 
       (spotify_id, name, description, created_by, max_songs_per_user, duration_hours)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [spotifyPlaylist.id, name, description || null, userId, max_songs_per_user || null, duration_hours || null]
    );

    const playlistId = result.lastID || 0;

    // Adicionar criador como admin
    await db.run(
      'INSERT INTO playlist_members (playlist_id, user_id, role) VALUES (?, ?, ?)',
      [playlistId, userId, 'admin']
    );

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id, data) VALUES (?, ?, ?, ?)',
      [playlistId, 'playlist_created', userId, JSON.stringify({ name })]
    );

    res.status(201).json({
      message: 'Playlist created successfully',
      playlist: {
        id: playlistId,
        spotify_id: spotifyPlaylist.id,
        name,
        description,
        spotify_url: spotifyPlaylist.external_urls.spotify
      }
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Listar playlists do usuario
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = req.user?.userId;

    const playlists = await db.all(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM playlist_members WHERE playlist_id = p.id) as member_count,
              (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) as song_count,
              pm.role
       FROM playlists p
       JOIN playlist_members pm ON p.id = pm.playlist_id
       WHERE pm.user_id = ?
       ORDER BY p.created_at DESC`,
      userId
    );

    res.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// Obter detalhes da playlist
router.get('/:playlistId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
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

    const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    const members = await db.all(
      `SELECT u.id, u.name, u.email, pm.role, pm.joined_at
       FROM playlist_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.playlist_id = ?
       ORDER BY pm.role DESC, u.name ASC`,
      playlistId
    );

    const songs = await db.all(
      `SELECT ps.*, u.name as added_by_name
       FROM playlist_songs ps
       JOIN users u ON ps.added_by = u.id
       WHERE ps.playlist_id = ?
       ORDER BY ps.position_in_queue ASC, ps.priority DESC, ps.created_at ASC`,
      playlistId
    );

    res.json({
      playlist,
      members,
      songs,
      user_role: membership.role
    });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

// Deletar playlist
router.delete('/:playlistId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const playlist = await db.get(
      'SELECT created_by, spotify_id FROM playlists WHERE id = ?',
      playlistId
    );

    if (!playlist || playlist.created_by !== userId) {
      res.status(403).json({ error: 'Only creator can delete playlist' });
      return;
    }

    // Deletar do Spotify
    if (playlist.spotify_id) {
      await spotifyService.deletePlaylist(playlist.spotify_id);
    }

    // Deletar do BD
    await db.run('DELETE FROM playlists WHERE id = ?', playlistId);

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id) VALUES (?, ?, ?)',
      [playlistId, 'playlist_deleted', userId]
    );

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// Reordenar fila (shuffle)
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
      res.status(403).json({ error: 'Only moderators/admins can shuffle queue' });
      return;
    }

    const songs = await db.all(
      `SELECT ps.* FROM playlist_songs ps
       WHERE ps.playlist_id = ?
       ORDER BY ps.priority DESC, RANDOM()`,
      playlistId
    );

    const songsByUser: { [key: number]: typeof songs } = {};
    songs.forEach(song => {
      if (!songsByUser[song.added_by]) {
        songsByUser[song.added_by] = [];
      }
      songsByUser[song.added_by].push(song);
    });

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

    for (let i = 0; i < queue.length; i++) {
      await db.run(
        'UPDATE playlist_songs SET position_in_queue = ? WHERE id = ?',
        [i + 1, queue[i].id]
      );
    }

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id) VALUES (?, ?, ?)',
      [playlistId, 'queue_shuffled', userId]
    );

    res.json({ message: 'Queue shuffled successfully' });
  } catch (error) {
    console.error('Error shuffling queue:', error);
    res.status(500).json({ error: 'Failed to shuffle queue' });
  }
});

export default router;
