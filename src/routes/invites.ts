import express, { Router, Response } from 'express';
import { getDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Gerar convite por link (reutilizável)
router.post('/:playlistId/invite-link', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { role = 'member', expiresIn = 7, maxUses } = req.body;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar permissão
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only admins/moderators can create invites' });
      return;
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000);

    const result = await db.run(
      `INSERT INTO invites (playlist_id, token, role, created_by, expires_at, max_uses)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [playlistId, token, role, userId, expiresAt.toISOString(), maxUses || null]
    );

    const frontendBaseUrl = (process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173').replace(/\/$/, '');
    const inviteLink = `${frontendBaseUrl}/join/${token}`;

    res.json({
      invite_id: result.lastID,
      link: inviteLink,
      token,
      role,
      expires_at: expiresAt,
      max_uses: maxUses || null,
      uses: 0
    });
  } catch (error) {
    console.error('Error creating invite link:', error);
    res.status(500).json({ error: 'Failed to create invite link' });
  }
});

// Gerar convite por email
// router.post('/:playlistId/invite-email', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { playlistId } = req.params;
//     const { email, role = 'member' } = req.body;
//     const userId = req.user?.userId;
//     const db = getDatabase();
//
//     if (!email) {
//       res.status(400).json({ error: 'Email is required' });
//       return;
//     }
//
//     // Verificar permissão
//     const membership = await db.get(
//       'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
//       [playlistId, userId]
//     );
//
//     if (!membership || !['admin', 'moderator'].includes(membership.role)) {
//       res.status(403).json({ error: 'Only admins/moderators can send invites' });
//       return;
//     }
//
//     const token = uuidv4();
//     const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias
//
//     const result = await db.run(
//       `INSERT INTO invites (playlist_id, email, token, role, created_by, expires_at)
//        VALUES (?, ?, ?, ?, ?, ?)`,
//       [playlistId, email, token, role, userId, expiresAt.toISOString()]
//     );
//
//     // TODO: Enviar email com link de convite
//     // sendInviteEmail(email, token, playlist.name);
//
//     const frontendBaseUrl = (process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173').replace(/\/$/, '');
//     const inviteLink = `${frontendBaseUrl}/join/${token}`;
//
//     res.json({
//       message: 'Invite sent successfully',
//       invite_id: result.lastID,
//       email,
//       invite_link: inviteLink
//     });
//   } catch (error) {
//     console.error('Error creating email invite:', error);
//     res.status(500).json({ error: 'Failed to create invite' });
//   }
// });

// Aceitar convite
router.post('/accept/:token', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar convite
    const invite = await db.get(
      `SELECT * FROM invites 
       WHERE token = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      token
    );

    if (!invite) {
      res.status(400).json({ error: 'Invalid or expired invite' });
      return;
    }

    // Verificar limite de usos
    if (invite.max_uses) {
      const uses = invite.uses || 0;
      if (uses >= invite.max_uses) {
        res.status(400).json({ error: 'Invite link has reached maximum uses' });
        return;
      }
    }

    // Verificar se ja é membro
    const existing = await db.get(
      'SELECT id FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [invite.playlist_id, userId]
    );

    if (existing) {
      res.status(409).json({ error: 'Already a member' });
      return;
    }

    // Adicionar membro
    await db.run(
      'INSERT INTO playlist_members (playlist_id, user_id, role) VALUES (?, ?, ?)',
      [invite.playlist_id, userId, invite.role]
    );

    // Incrementar uso do convite (não marcar como "usado" se tiver max_uses)
    if (invite.max_uses) {
      await db.run(
        'UPDATE invites SET uses = uses + 1 WHERE id = ?',
        invite.id
      );
    } else {
      // Se não tiver limite, marcar como usado
      await db.run(
        'UPDATE invites SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
        invite.id
      );
    }

    // Analytics
    await db.run(
      'INSERT INTO analytics (playlist_id, event_type, user_id, data) VALUES (?, ?, ?, ?)',
      [invite.playlist_id, 'user_joined', userId, JSON.stringify({ role: invite.role })]
    );

    // Notificar outros membros da playlist em tempo real
    const { io } = require('../index');
    if (io) {
      io.to(`playlist:${invite.playlist_id}`).emit('member_joined', {
        playlist_id: invite.playlist_id,
        user_id: userId,
        role: invite.role,
      });
    }
    res.json({ message: 'Successfully joined playlist' });
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// Listar convites da playlist
router.get('/:playlistId/invites', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar permissão
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only admins/moderators can view invites' });
      return;
    }

    const invites = await db.all(
      `SELECT id, email, role, created_by, expires_at, used_at, max_uses, uses, created_at, token
       FROM invites
       WHERE playlist_id = ?
       ORDER BY created_at DESC`,
      playlistId
    );

    res.json(invites);
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Deletar/Revogar convite
router.delete('/:playlistId/invites/:inviteId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId, inviteId } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    // Verificar permissão
    const membership = await db.get(
      'SELECT role FROM playlist_members WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!membership || !['admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'Only admins/moderators can revoke invites' });
      return;
    }

    // Verificar que o convite pertence a esta playlist
    const invite = await db.get(
      'SELECT id FROM invites WHERE id = ? AND playlist_id = ?',
      [inviteId, playlistId]
    );

    if (!invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    await db.run('DELETE FROM invites WHERE id = ? AND playlist_id = ?', [inviteId, playlistId]);

    res.json({ message: 'Invite revoked' });
  } catch (error) {
    console.error('Error revoking invite:', error);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

export default router;
