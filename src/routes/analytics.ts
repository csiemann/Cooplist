import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Obter analytics da playlist (apenas moderators e admins)
router.get('/:playlistId/analytics', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    console.log(`[Analytics] Fetching for playlist ${playlistId}, user ${userId}`);

    // Verificar acesso
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership) {
      console.log(`[Analytics] Access denied for user ${userId} on playlist ${playlistId}`);
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // RESTRIÇÃO: Apenas moderadores e admins podem ver analytics
    if (!['admin', 'moderator'].includes(membership.role)) {
      console.log(`[Analytics] User ${userId} is ${membership.role}, not authorized to view analytics`);
      res.status(403).json({ error: 'Only moderators and admins can view analytics' });
      return;
    }

    const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', playlistId);

    if (!playlist) {
      console.log(`[Analytics] Playlist ${playlistId} not found`);
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Total de musicas
    const totalSongs = await db.get(
      'SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ?',
      playlistId
    );

    // Total de membros
    const totalMembers = await db.get(
      'SELECT COUNT(*) as count FROM playlist_members WHERE playlist_id = ?',
      playlistId
    );

    // Musicas por usuario
    const songsByUser = await db.all(
      `SELECT u.name, COUNT(*) as count
       FROM playlist_songs ps
       JOIN users u ON ps.added_by = u.id
       WHERE ps.playlist_id = ?
       GROUP BY ps.added_by
       ORDER BY count DESC`,
      playlistId
    );

    // Eventos recentes
    const recentEvents = await db.all(
      `SELECT a.event_type, a.created_at, u.name
       FROM analytics a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.playlist_id = ?
       ORDER BY a.created_at DESC
       LIMIT 20`,
      playlistId
    );

    // Duracao total
    const totalDuration = await db.get(
      `SELECT SUM(track_duration_ms) as total_ms
       FROM playlist_songs
       WHERE playlist_id = ?`,
      playlistId
    );

    const durationHours = (totalDuration?.total_ms || 0) / 1000 / 60 / 60;
    const durationMinutes = (totalDuration?.total_ms || 0) / 1000 / 60;

    console.log(`[Analytics] Success: ${totalSongs?.count || 0} songs, ${totalMembers?.count || 0} members`);

    res.json({
      playlist,
      stats: {
        total_songs: totalSongs?.count || 0,
        total_members: totalMembers?.count || 0,
        total_duration_minutes: Math.round(durationMinutes * 100) / 100,
        total_duration_hours: Math.round(durationHours * 100) / 100,
        songs_by_user: songsByUser,
        recent_events: recentEvents
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
