import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import spotifyService from '../services/spotifyService';

const router = Router();

// Buscar no Spotify
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, limit = '20' } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Query (q) is required' });
      return;
    }

    const tracks = await spotifyService.searchTracks(q, parseInt(limit as string));

    res.json({
      results: tracks.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        duration_ms: track.duration_ms,
        external_url: track.external_urls.spotify,
        image: track.album?.images[0]?.url
      }))
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Listar favoritos
router.get('/favorites', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const db = getDatabase();

    const favorites = await db.all(
      `SELECT * FROM user_favorites 
       WHERE user_id = ? 
       ORDER BY added_at DESC`,
      userId
    );

    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Adicionar aos favoritos
router.post('/favorites', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { spotify_track_id, track_name, artist_name, track_duration_ms } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    if (!spotify_track_id || !track_name || !artist_name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await db.run(
      `INSERT INTO user_favorites 
       (user_id, spotify_track_id, track_name, artist_name, track_duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, spotify_track_id, track_name, artist_name, track_duration_ms || 0]
    );

    res.status(201).json({ message: 'Added to favorites' });
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Already in favorites' });
    } else {
      console.error('Error adding favorite:', error);
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  }
});

// Remover dos favoritos
router.delete('/favorites/:favoriteId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { favoriteId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const favorite = await db.get(
      'SELECT user_id FROM user_favorites WHERE id = ?',
      favoriteId
    );

    if (!favorite || favorite.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await db.run('DELETE FROM user_favorites WHERE id = ?', favoriteId);

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

export default router;
