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

// Remover membro
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

    await db.run('DELETE FROM playlist_members WHERE id = ? AND playlist_id = ?', [memberId, playlistId]);

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id) VALUES (?, ?, ?)',
      [playlistId, 'member_removed', member.user_id]
    );

    // Notificar via WebSocket
    io?.to(`playlist:${playlistId}`).emit('member_removed', {
      member_id: memberId,
      user_id: member.user_id
    });

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
