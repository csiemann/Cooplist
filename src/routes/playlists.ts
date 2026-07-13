import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

interface CreatePlaylistRequest {
  name: string;
  description?: string;
  max_songs_per_user?: number;
  duration_hours?: number;
}

// CRUD: Listar playlists do usuário (como membro)
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
       WHERE pm.user_id = ? AND pm.is_banned = 0
       ORDER BY p.created_at DESC`,
      userId
    );

    res.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// CRUD: Criar nova playlist (apenas admin/moderator)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, max_songs_per_user, duration_hours } = req.body as CreatePlaylistRequest;
    const userId = req.user?.userId;

    if (!name) {
      res.status(400).json({ error: 'Playlist name is required' });
      return;
    }

    const db = getDatabase();

    // Criar playlist
    const playlistResult = await db.run(
      `INSERT INTO playlists (name, description, created_by, max_songs_per_user, duration_hours) 
       VALUES (?, ?, ?, ?, ?)`,
      [name, description || null, userId, max_songs_per_user || null, duration_hours || null]
    );

    const playlistId = playlistResult.lastID || 0;

    // Adicionar criador como admin
    await db.run(
      'INSERT INTO playlist_members (playlist_id, user_id, role) VALUES (?, ?, ?)',
      [playlistId, userId, 'admin']
    );

    const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    res.status(201).json({
      message: 'Playlist created successfully',
      playlist
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Obter detalhes de uma playlist
router.get('/:playlistId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar se usuário é membro e não está banido
    const membership = await db.get(
      'SELECT role, is_banned FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || membership.is_banned) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Obter membros
    const members = await db.all(
      `SELECT u.id, u.name, u.email, pm.role, pm.is_banned, pm.joined_at
       FROM playlist_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.playlist_id = ?
       ORDER BY pm.role DESC, u.name ASC`,
      playlistId
    );

    // Obter músicas ordenadas por fila
    const songs = await db.all(
      `SELECT ps.*, u.name as added_by_name
       FROM playlist_songs ps
       JOIN users u ON ps.added_by = u.id
       WHERE ps.playlist_id = ? AND ps.is_banned = 0
       ORDER BY ps.position_in_queue ASC, ps.priority ASC, ps.added_at ASC`,
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

// Atualizar configurações da playlist (apenas admin)
router.put('/:playlistId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { name, description, max_songs_per_user, duration_hours } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admin can update playlist' });
      return;
    }

    await db.run(
      `UPDATE playlists SET name = ?, description = ?, max_songs_per_user = ?, duration_hours = ? 
       WHERE id = ?`,
      [name, description, max_songs_per_user, duration_hours, playlistId]
    );

    const updated = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    res.json({
      message: 'Playlist updated successfully',
      playlist: updated
    });
  } catch (error) {
    console.error('Error updating playlist:', error);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

// Deletar playlist (apenas admin)
router.delete('/:playlistId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const playlist = await db.get(
      'SELECT created_by FROM playlists WHERE id = ?',
      playlistId
    );

    if (!playlist || playlist.created_by !== userId) {
      res.status(403).json({ error: 'Only creator can delete playlist' });
      return;
    }

    await db.run('DELETE FROM playlists WHERE id = ?', playlistId);

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

export default router;
