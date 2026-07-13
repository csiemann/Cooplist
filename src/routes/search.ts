import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import spotifyService from '../services/spotifyService';

const router = Router();

// Buscar músicas no Spotify
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, limit = '20' } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query (q) is required' });
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

export default router;
