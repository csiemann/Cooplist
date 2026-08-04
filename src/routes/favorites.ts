import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Listar favoritos do usuário
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
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

// Adicionar música aos favoritos
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { spotify_track_id, track_name, artist_name, track_duration_ms, spotify_url } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    if (!spotify_track_id || !track_name || !artist_name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await db.run(
      `INSERT INTO user_favorites 
       (user_id, spotify_track_id, track_name, artist_name, track_duration_ms, spotify_url) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, spotify_track_id, track_name, artist_name, track_duration_ms || 0, spotify_url || null]
    );

    const favorite = await db.get('SELECT * FROM user_favorites WHERE id = ?', result.lastID);

    res.status(201).json({
      message: 'Song added to favorites',
      favorite
    });
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Song already in favorites' });
    } else {
      console.error('Error adding favorite:', error);
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  }
});

// Remover dos favoritos
router.delete('/:favoriteId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
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

    res.json({ message: 'Favorite removed' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Remover dos favoritos por spotify_track_id
router.delete('/track/:spotifyTrackId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { spotifyTrackId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    await db.run(
      'DELETE FROM user_favorites WHERE user_id = ? AND spotify_track_id = ?',
      [userId, spotifyTrackId]
    );

    res.json({ message: 'Favorite removed' });
  } catch (error) {
    console.error('Error removing favorite by track id:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

export default router;
