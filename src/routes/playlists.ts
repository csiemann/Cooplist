import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import spotifyService from '../services/spotifyService';

const router = Router();

interface Playlist {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  created_at: string;
}

interface PlaylistCreateRequest {
  name: string;
  description?: string;
  syncSpotify?: boolean;
}

// CRUD: Listar todas as playlists do usuário
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const playlists = await db.all(
      `SELECT p.* FROM playlists p 
       WHERE p.owner_id = ? OR p.id IN (
         SELECT playlist_id FROM playlist_collaborators WHERE user_id = ?
       )
       ORDER BY p.created_at DESC`,
      [req.user?.userId, req.user?.userId]
    );

    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// CRUD: Criar nova playlist
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, syncSpotify } = req.body as PlaylistCreateRequest;

    if (!name) {
      res.status(400).json({ error: 'Playlist name is required' });
      return;
    }

    const db = getDatabase();
    let spotifyPlaylistId = null;

    // Sincronizar com Spotify se solicitado
    if (syncSpotify) {
      const user = await db.get('SELECT spotify_id FROM users WHERE id = ?', req.user?.userId);
      if (user?.spotify_id) {
        // Aqui você usaria o token de acesso armazenado
        // const spotifyPlaylist = await spotifyService.createPlaylist(user.spotify_id, name, description || '', token);
        // spotifyPlaylistId = spotifyPlaylist.id;
      }
    }

    const result = await db.run(
      'INSERT INTO playlists (owner_id, name, description, spotify_playlist_id) VALUES (?, ?, ?, ?)',
      [req.user?.userId, name, description || null, spotifyPlaylistId]
    );

    const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', result.lastID);

    res.status(201).json({
      message: 'Playlist created successfully',
      playlist
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// CRUD: Obter detalhes de uma playlist
router.get('/:playlistId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const db = getDatabase();

    const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Verificar permissão
    if (playlist.owner_id !== req.user?.userId) {
      const isCollaborator = await db.get(
        'SELECT id FROM playlist_collaborators WHERE playlist_id = ? AND user_id = ?',
        [playlistId, req.user?.userId]
      );

      if (!isCollaborator) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const songs = await db.all(
      `SELECT ps.*, u.name as added_by_name FROM playlist_songs ps
       JOIN users u ON ps.added_by = u.id
       WHERE ps.playlist_id = ?
       ORDER BY ps.added_at DESC`,
      playlistId
    );

    const collaborators = await db.all(
      'SELECT u.id, u.name, u.email, pc.role FROM playlist_collaborators pc JOIN users u ON pc.user_id = u.id WHERE pc.playlist_id = ?',
      playlistId
    );

    res.json({
      playlist,
      songs,
      collaborators
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

// CRUD: Atualizar playlist
router.put('/:playlistId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { name, description } = req.body;
    const db = getDatabase();

    const playlist = await db.get('SELECT owner_id FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    if (playlist.owner_id !== req.user?.userId) {
      res.status(403).json({ error: 'Only owner can update playlist' });
      return;
    }

    await db.run(
      'UPDATE playlists SET name = ?, description = ? WHERE id = ?',
      [name, description, playlistId]
    );

    const updated = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    res.json({
      message: 'Playlist updated successfully',
      playlist: updated
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

// CRUD: Deletar playlist
router.delete('/:playlistId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const db = getDatabase();

    const playlist = await db.get('SELECT owner_id FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    if (playlist.owner_id !== req.user?.userId) {
      res.status(403).json({ error: 'Only owner can delete playlist' });
      return;
    }

    await db.run('DELETE FROM playlists WHERE id = ?', playlistId);

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// Adicionar música à playlist
router.post('/:playlistId/songs', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { spotify_track_id, track_name, artist_name } = req.body;
    const db = getDatabase();

    const playlist = await db.get('SELECT id FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    const result = await db.run(
      'INSERT INTO playlist_songs (playlist_id, spotify_track_id, track_name, artist_name, added_by) VALUES (?, ?, ?, ?, ?)',
      [playlistId, spotify_track_id, track_name, artist_name, req.user?.userId]
    );

    const song = await db.get('SELECT * FROM playlist_songs WHERE id = ?', result.lastID);

    res.status(201).json({
      message: 'Song added successfully',
      song
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add song' });
  }
});

// Remover música da playlist
router.delete('/:playlistId/songs/:songId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, songId } = req.params;
    const db = getDatabase();

    const song = await db.get('SELECT added_by FROM playlist_songs WHERE id = ? AND playlist_id = ?', [songId, playlistId]);

    if (!song) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }

    if (song.added_by !== req.user?.userId) {
      res.status(403).json({ error: 'Only song uploader can delete it' });
      return;
    }

    await db.run('DELETE FROM playlist_songs WHERE id = ?', songId);

    res.json({ message: 'Song removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove song' });
  }
});

// Adicionar colaborador
router.post('/:playlistId/collaborators', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { user_id, role = 'contributor' } = req.body;
    const db = getDatabase();

    const playlist = await db.get('SELECT owner_id FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    if (playlist.owner_id !== req.user?.userId) {
      res.status(403).json({ error: 'Only owner can add collaborators' });
      return;
    }

    const result = await db.run(
      'INSERT INTO playlist_collaborators (playlist_id, user_id, role) VALUES (?, ?, ?)',
      [playlistId, user_id, role]
    );

    res.status(201).json({
      message: 'Collaborator added successfully',
      collaborator_id: result.lastID
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

export default router;
