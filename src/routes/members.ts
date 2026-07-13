import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Adicionar usuário à playlist (invite - admin/moderator)
router.post('/:playlistId/members', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { email, role = 'user' } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar permissão do invitador
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only admins and moderators can invite users' });
      return;
    }

    // Obter ID do novo usuário
    const newUser = await db.get('SELECT id FROM users WHERE email = ?', email);

    if (!newUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verificar se já é membro
    const existing = await db.get(
      'SELECT id FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, newUser.id]
    );

    if (existing) {
      res.status(409).json({ error: 'User is already a member' });
      return;
    }

    const result = await db.run(
      'INSERT INTO playlist_members (playlist_id, user_id, role) VALUES (?, ?, ?)',
      [playlistId, newUser.id, role]
    );

    res.status(201).json({
      message: 'User added to playlist',
      member_id: result.lastID
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Listar membros da playlist
router.get('/:playlistId/members', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar acesso
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const members = await db.all(
      `SELECT u.id, u.name, u.email, pm.role, pm.is_banned, pm.joined_at,
              (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ? AND added_by = u.id AND is_banned = 0) as song_count
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

// Alterar role do membro (admin only)
router.patch('/:playlistId/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar se é admin
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admin can change roles' });
      return;
    }

    await db.run(
      'UPDATE playlist_members SET role = ? WHERE id = ? AND playlist_id = ?',
      [role, memberId, playlistId]
    );

    res.json({ message: 'Member role updated' });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Banir usuário da playlist
router.post('/:playlistId/members/:memberId/ban', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, memberId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar permissão
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only moderators and admins can ban users' });
      return;
    }

    const memberToban = await db.get(
      'SELECT user_id FROM playlist_members WHERE id = ? AND playlist_id = ?',
      [memberId, playlistId]
    );

    if (!memberToban) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    await db.run(
      'UPDATE playlist_members SET is_banned = 1 WHERE id = ?',
      memberId
    );

    await db.run(
      'INSERT INTO ban_history (playlist_id, user_id, banned_by, reason) VALUES (?, ?, ?, ?)',
      [playlistId, memberToban.user_id, userId, reason || 'No reason provided']
    );

    res.json({ message: 'User banned from playlist' });
  } catch (error) {
    console.error('Error banning member:', error);
    res.status(500).json({ error: 'Failed to ban member' });
  }
});

// Desbanir usuário
router.post('/:playlistId/members/:memberId/unban', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, memberId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar permissão
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only moderators and admins can unban users' });
      return;
    }

    const member = await db.get(
      'SELECT user_id FROM playlist_members WHERE id = ? AND playlist_id = ?',
      [memberId, playlistId]
    );

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    await db.run(
      'UPDATE playlist_members SET is_banned = 0 WHERE id = ?',
      memberId
    );

    await db.run(
      'UPDATE ban_history SET unbanned_at = CURRENT_TIMESTAMP WHERE user_id = ? AND playlist_id = ? AND unbanned_at IS NULL',
      [member.user_id, playlistId]
    );

    res.json({ message: 'User unbanned from playlist' });
  } catch (error) {
    console.error('Error unbanning member:', error);
    res.status(500).json({ error: 'Failed to unban member' });
  }
});

// Remover usuário da playlist
router.delete('/:playlistId/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, memberId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar permissão
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only moderators and admins can remove users' });
      return;
    }

    await db.run('DELETE FROM playlist_members WHERE id = ? AND playlist_id = ?', [memberId, playlistId]);

    res.json({ message: 'User removed from playlist' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
