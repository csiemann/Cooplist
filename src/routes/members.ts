import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { io } from '../index';

const router = Router();

// Gerenciar membros
router.get('/:playlistId/members', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const members = await db.all(
      `SELECT u.id, u.name, u.email, pm.role, pm.joined_at,
              (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ? AND added_by = u.id) as song_count
       FROM playlist_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.playlist_id = ?
       ORDER BY pm.role DESC, u.name ASC`,
      [playlistId, playlistId]
    );

    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Alterar role
router.patch('/:playlistId/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can change roles' });
      return;
    }

    await db.run(
      'UPDATE playlist_members SET role = ? WHERE id = ? AND playlist_id = ?',
      [role, memberId, playlistId]
    );

    // Notificar via WebSocket
    io?.to(`playlist:${playlistId}`).emit('member_role_updated', {
      member_id: memberId,
      new_role: role
    });

    res.json({ message: 'Role updated' });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Remover membro (SEM banir - pode entrar novamente)
router.delete('/:playlistId/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, memberId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only admins/moderators can remove members' });
      return;
    }

    const member = await db.get(
      'SELECT user_id, role FROM playlist_members WHERE id = ? AND playlist_id = ?',
      [memberId, playlistId]
    );

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Prevent moderator from removing an admin
    if (membership.role === 'moderator' && member.role === 'admin') {
      res.status(403).json({ error: 'Moderators cannot remove administrators' });
      return;
    }

    // Apenas remover (membro pode entrar novamente)
    await db.run('DELETE FROM playlist_members WHERE id = ? AND playlist_id = ?', [memberId, playlistId]);

    // Remover músicas adicionadas pelo membro removido
    await db.run('DELETE FROM playlist_songs WHERE playlist_id = ? AND added_by = ?', [playlistId, member.user_id]);

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id, data) VALUES (?, ?, ?, ?)',
      [playlistId, 'member_removed', member.user_id, JSON.stringify({ reason: 'removed' })]
    );

    // Notificar via WebSocket
    io?.to(`playlist:${playlistId}`).emit('member_removed', {
      member_id: memberId,
      user_id: member.user_id
    });
    io?.to(`playlist:${playlistId}`).emit('song_removed', { playlist_id: playlistId });
    io?.to(`playlist:${playlistId}`).emit('analytics_updated', { playlist_id: playlistId });

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Ban member (impedindo reentrada)
router.post('/:playlistId/members/:memberId/ban', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, memberId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only admins/moderators can ban members' });
      return;
    }

    const member = await db.get(
      'SELECT user_id, role FROM playlist_members WHERE id = ? AND playlist_id = ?',
      [memberId, playlistId]
    );

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Prevent moderator from banning an admin
    if (membership.role === 'moderator' && member.role === 'admin') {
      res.status(403).json({ error: 'Moderators cannot ban administrators' });
      return;
    }

    // Criar ban record
    await db.run(
      `INSERT INTO playlist_bans (playlist_id, user_id, banned_by, reason)
       VALUES (?, ?, ?, ?)`,
      [playlistId, member.user_id, userId, reason || null]
    );

    // Remover da playlist
    await db.run('DELETE FROM playlist_members WHERE id = ? AND playlist_id = ?', [memberId, playlistId]);

    // Remover músicas adicionadas pelo membro banido
    await db.run('DELETE FROM playlist_songs WHERE playlist_id = ? AND added_by = ?', [playlistId, member.user_id]);

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id, data) VALUES (?, ?, ?, ?)',
      [playlistId, 'member_banned', member.user_id, JSON.stringify({ reason })]
    );

    // Notificar via WebSocket
    io?.to(`playlist:${playlistId}`).emit('member_banned', {
      member_id: memberId,
      user_id: member.user_id,
      reason
    });
    io?.to(`playlist:${playlistId}`).emit('song_removed', { playlist_id: playlistId });
    io?.to(`playlist:${playlistId}`).emit('analytics_updated', { playlist_id: playlistId });

    res.json({ message: 'Member banned' });
  } catch (error) {
    console.error('Error banning member:', error);
    res.status(500).json({ error: 'Failed to ban member' });
  }
});

// Desban member
router.post('/:playlistId/members/:userId/unban', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, userId: bannerUserId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can unban members' });
      return;
    }

    // Remover ban
    await db.run(
      'DELETE FROM playlist_bans WHERE playlist_id = ? AND user_id = ?',
      [playlistId, bannerUserId]
    );

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id, data) VALUES (?, ?, ?, ?)',
      [playlistId, 'member_unbanned', bannerUserId, JSON.stringify({})]
    );

    // Notificar via WebSocket
    io?.to(`playlist:${playlistId}`).emit('analytics_updated', { playlist_id: playlistId });

    res.json({ message: 'Member unbanned' });
  } catch (error) {
    console.error('Error unbanning member:', error);
    res.status(500).json({ error: 'Failed to unban member' });
  }
});

export default router;
