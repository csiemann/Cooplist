import express, { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import spotifyService from '../services/spotifyService';

const router = Router();

// Buscar músicas no Spotify
router.get('/search', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, limit = '10' } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    // Nota: Para fazer busca real, você precisa armazenar o accessToken do usuário
    // Por enquanto, retornamos um erro instruindo sobre como implementar
    res.status(400).json({
      error: 'Spotify search requires stored access token',
      hint: 'Store user Spotify tokens after login to enable track search'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
