import { useEffect, useState } from 'react';
import { getMembers, inviteMember, createInviteLink, updateMemberRole, removeMember } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Playlist, Song } from '../types';

interface PlaylistDetailsProps {
  playlist: Playlist;
  songs: Song[];
}

export default function PlaylistDetails({ playlist, songs }: PlaylistDetailsProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    loadMembers();
  }, [playlist.id]);

  const loadMembers = async () => {
    try {
      const res = await getMembers(playlist.id);
      setMembers(res.data || []);
    } catch {
      setMembers([]);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!inviteEmail.trim()) return;

    try {
      await inviteMember(playlist.id, { email: inviteEmail, role: inviteRole });
      setSuccess('Convite enviado com sucesso');
      setInviteEmail('');
      loadMembers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Falha ao enviar convite');
    }
  };

  const handleCreateLink = async () => {
    setError('');
    setSuccess('');
    setInviteLink('');

    try {
      const res = await createInviteLink(playlist.id, { role: inviteRole });
      setInviteLink(res.data.link);
      setSuccess('Link de convite gerado');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Falha ao gerar link de convite');
    }
  };

  const handleRoleChange = async (memberId: number, role: string) => {
    setError('');
    setSuccess('');

    try {
      await updateMemberRole(playlist.id, memberId, role);
      setSuccess('Role atualizada');
      loadMembers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Falha ao atualizar role');
    }
  };

  const handleRemove = async (memberId: number) => {
    setError('');
    setSuccess('');

    try {
      await removeMember(playlist.id, memberId);
      setSuccess('Membro removido');
      loadMembers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Falha ao remover membro');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Membros</h3>
        {error && <div style={{ color: '#ff7a7a', marginBottom: '12px' }}>{error}</div>}
        {success && <div style={{ color: '#63d3ff', marginBottom: '12px' }}>{success}</div>}

        {user?.role && ['admin', 'moderator'].includes(user.role) ? (
          <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Convidar por email" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #223449', background: '#111c2b', color: 'white' }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ flex: '1 1 140px', padding: '10px', borderRadius: '8px', border: '1px solid #223449', background: '#111c2b', color: 'white' }}>
                <option value="user">Usuário</option>
                <option value="moderator">Moderador</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleInvite} style={{ flex: '1 1 180px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: '#1db954', color: 'black', cursor: 'pointer' }}>Convidar por email</button>
              <button type="button" onClick={handleCreateLink} style={{ flex: '1 1 180px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer' }}>Gerar link de convite</button>
            </div>
            {inviteLink && (
              <div style={{ background: '#111c2b', padding: '12px', borderRadius: '10px', border: '1px solid #223449', wordBreak: 'break-all' }}>
                <strong>Link de convite:</strong>
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ flex: 1 }}>{inviteLink}</span>
                  <button type="button" onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#1db954', color: 'black', cursor: 'pointer' }}>Copiar</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#9fb0c3', marginBottom: '12px' }}>Somente administradores e moderadores podem convidar membros.</div>
        )}

        <div style={{ display: 'grid', gap: '8px' }}>
          {members.map((member) => (
            <div key={member.id} style={{ padding: '10px', borderRadius: '10px', background: '#111c2b', border: '1px solid #223449', display: 'grid', gap: '8px' }}>
              <div style={{ fontWeight: 700 }}>{member.name}</div>
              <div style={{ color: '#9fb0c3', fontSize: '13px' }}>{member.email} • {member.role}</div>
              {user?.role && ['admin', 'moderator'].includes(user.role) && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleRoleChange(member.id, member.role === 'admin' ? 'moderator' : 'admin')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#1db954', color: 'black', cursor: 'pointer' }}>
                    {member.role === 'admin' ? 'Tornar moderador' : 'Tornar admin'}
                  </button>
                  <button onClick={() => handleRemove(member.id)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#ff5c5c', color: 'white', cursor: 'pointer' }}>
                    Remover
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Detalhes da fila</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {songs.map((song) => (
            <div key={song.id} style={{ padding: '10px', borderRadius: '10px', background: '#111c2b', border: '1px solid #223449' }}>
              <div style={{ fontWeight: 700 }}>{song.track_name}</div>
              <div style={{ color: '#9fb0c3', fontSize: '13px' }}>Prioridade: {song.priority ?? 0}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
