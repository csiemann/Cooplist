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

interface CreateSpotifyPlaylistRequest {
  spotifyAccessToken: string; // User's Spotify access token
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

    const currentUser = await db.get('SELECT role FROM users WHERE id = ?', userId);
    if (!currentUser || !['admin', 'moderator'].includes(currentUser.role)) {
      res.status(403).json({ error: 'Only admins and moderators can create playlists' });
      return;
    }

    // Criar no Spotify ou fallback local
    let spotifyPlaylistId: string | null = null;
    let spotifyUrl: string | null = null;

    try {
      const spotifyPlaylist = await spotifyService.createPlaylist(name, description || '');
      spotifyPlaylistId = spotifyPlaylist.id;
      spotifyUrl = spotifyPlaylist.external_urls?.spotify || null;
    } catch (error) {
      console.warn('Failed to create Spotify playlist, continuing with local playlist only:', error);
    }

    // Salvar no BD
    const result = await db.run(
      `INSERT INTO playlists 
       (spotify_id, name, description, created_by, max_songs_per_user, duration_hours)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [spotifyPlaylistId, name, description || null, userId, max_songs_per_user || null, duration_hours || null]
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
        spotify_id: spotifyPlaylistId,
        name,
        description,
        spotify_url: spotifyUrl
      }
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Criar playlist no Spotify (usando user access token)
// POST /api/playlists/:playlistId/sync-to-spotify
router.post('/:playlistId/sync-to-spotify', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { spotifyAccessToken } = req.body as CreateSpotifyPlaylistRequest;
    const userId = req.user?.userId;
    const db = getDatabase();

    if (!spotifyAccessToken) {
      res.status(400).json({ error: 'Spotify access token is required' });
      return;
    }

    // Verificar acesso
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only admins/moderators can create playlist on Spotify' });
      return;
    }

    // Obter playlist
    const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Se já existe no Spotify, retornar erro
    if (playlist.spotify_id && !playlist.spotify_id.includes('fallback')) {
      res.status(400).json({ error: 'Playlist already exists on Spotify' });
      return;
    }

    try {
      // Criar playlist no Spotify com user token
      const spotifyPlaylist = await spotifyService.createPlaylistWithUserToken(
        spotifyAccessToken,
        playlist.name,
        playlist.description || '',
        false // Privado por padrão
      );

      // Atualizar com Spotify ID
      await db.run(
        'UPDATE playlists SET spotify_id = ? WHERE id = ?',
        [spotifyPlaylist.id, playlistId]
      );

      // Adicionar todas as músicas atuais à playlist no Spotify
      const songs = await db.all(
        'SELECT spotify_track_id FROM playlist_songs WHERE playlist_id = ? AND spotify_track_id IS NOT NULL',
        playlistId
      );

      if (songs.length > 0) {
        const trackIds = songs.map(s => s.spotify_track_id).filter(Boolean);
        await spotifyService.addTracksToPlaylist(spotifyPlaylist.id, trackIds, spotifyAccessToken);
      }

      // Analytics
      await db.run(
        'INSERT INTO analytics (playlist_id, event_type, user_id, data) VALUES (?, ?, ?, ?)',
        [playlistId, 'playlist_synced_to_spotify', userId, JSON.stringify({ spotify_id: spotifyPlaylist.id })]
      );

      res.json({
        message: 'Playlist created on Spotify',
        spotify_playlist: {
          id: spotifyPlaylist.id,
          name: spotifyPlaylist.name,
          url: spotifyPlaylist.external_urls.spotify
        }
      });
    } catch (error: any) {
      console.error('Error creating Spotify playlist:', error);
      res.status(500).json({
        error: 'Failed to create playlist on Spotify',
        details: error?.message || 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error syncing playlist:', error);
    res.status(500).json({ error: 'Failed to sync playlist' });
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

    const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    console.log('playlist: ', playlist);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Verificar acesso
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    console.log('membership: ', membership);

    // Se a playlist não for pública, o usuário deve ser membro
    if (playlist.is_public !== 1 && !membership) {
      res.status(403).json({ error: 'Access denied to private playlist' });
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
      user_role: membership ? membership.role : null
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

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can delete this playlist' });
      return;
    }

    const playlist = await db.get(
      'SELECT spotify_id FROM playlists WHERE id = ?',
      playlistId
    );

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Deletar do Spotify
    if (playlist.spotify_id && !playlist.spotify_id.includes('fallback') && !playlist.spotify_id.includes('local')) {
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
