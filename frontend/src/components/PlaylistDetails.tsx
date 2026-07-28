import { useEffect, useState } from 'react';
import { getMembers, createInviteLink, updateMemberRole, removeMember, removeSongFromPlaylist } from '../services/api';
// import { inviteMember, createInviteLink } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { usePlaylistStore } from '../stores/playlistStore';
import type { Playlist, Song } from '../types';

interface PlaylistDetailsProps {
  playlist: Playlist;
  songs: Song[];
}

interface BanModal {
  type: 'song' | 'member' | null;
  targetId: number | null;
  targetName: string;
}

export default function PlaylistDetails({ playlist, songs }: PlaylistDetailsProps) {
  const [members, setMembers] = useState<any[]>([]);
  // const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [banModal, setBanModal] = useState<BanModal>({ type: null, targetId: null, targetName: '' });
  const [banReason, setBanReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuthStore();
  const { setSongs } = usePlaylistStore();

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

  /* const handleInvite = async (e: React.FormEvent) => {
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
  }; */

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

  const handleRoleChange = async (member: any) => {
    // Moderador não pode alterar admin
    if (user?.role === 'moderator' && member.role === 'admin') {
      setError('Moderadores não podem alterar cargos de administradores');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const newRole = member.role === 'admin' ? 'moderator' : 'admin';
      await updateMemberRole(playlist.id, member.id, newRole);
      setSuccess('Role atualizada');
      loadMembers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Falha ao atualizar role');
    }
  };

  const openBanMemberModal = (member: any) => {
    // Moderador não pode banir admin
    if (user?.role === 'moderator' && member.role === 'admin') {
      setError('Moderadores não podem banir administradores');
      return;
    }
    setBanModal({ type: 'member', targetId: member.id, targetName: member.name });
    setBanReason('');
  };

  const openBanSongModal = (song: Song) => {
    setBanModal({ type: 'song', targetId: song.id, targetName: song.track_name });
    setBanReason('');
  };

  const handleBanConfirm = async () => {
    if (!banModal.targetId) return;

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      if (banModal.type === 'member') {
        await removeMember(playlist.id, banModal.targetId);
        setSuccess('Membro removido e banido');
        loadMembers();
      } else if (banModal.type === 'song') {
        await removeSongFromPlaylist(playlist.id, banModal.targetId);
        setSuccess('Música removida da playlist');
        // Atualizar estado global de músicas
        const updatedSongs = songs.filter(s => s.id !== banModal.targetId);
        setSongs(updatedSongs);
      }
      closeBanModal();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Falha ao remover');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeBanModal = () => {
    setBanModal({ type: null, targetId: null, targetName: '' });
    setBanReason('');
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
              {/* <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Convidar por email" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #223449', background: '#111c2b', color: 'white' }} />*/}
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ flex: '1 1 140px', padding: '10px', borderRadius: '8px', border: '1px solid #223449', background: '#111c2b', color: 'white' }}>
                <option value="user">Usuário</option>
                <option value="moderator">Moderador</option>
              </select>
              <button type="button" onClick={handleCreateLink} style={{ flex: '1 1 180px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer' }}>Gerar link de convite</button>
            </div>
            {/* <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}> */}
            {/* <button type="button" onClick={handleInvite} style={{ flex: '1 1 180px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: '#1db954', color: 'black', cursor: 'pointer' }}>Convidar por email</button> */}
            {/* </div> */}
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
              <div style={{ fontWeight: 700 }}>
                {member.name} <span style={{ fontSize: '12px', color: '#63d3ff' }}>({member.role})</span>
              </div>
              <div style={{ color: '#9fb0c3', fontSize: '13px' }}>{member.email}</div>
              {user?.role && ['admin', 'moderator'].includes(user.role) && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Botão de role: somente admin pode alterar admin, moderador pode alterar user */}
                  {!(user.role === 'moderator' && member.role === 'admin') && (
                    !(user.id == member.id) && (<button onClick={() => handleRoleChange(member)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#1db954', color: 'black', cursor: 'pointer', opacity: user.role === 'moderator' && member.role === 'admin' ? 0.5 : 1 }} disabled={user.role === 'moderator' && member.role === 'admin'}>
                      {member.role === 'admin' ? 'Tornar moderador' : 'Tornar admin'}
                    </button>)
                  )}
                  {/* Botão de remover: abre modal de banimento */}
                  {!(user.id == member.id) && (<button onClick={() => openBanMemberModal(member)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#ff5c5c', color: 'white', cursor: 'pointer' }}>
                    Remover
                  </button>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </section >

      <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Fila de reprodução</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {songs.length > 0 ? (
            songs.map((song) => (
              <div key={song.id} style={{ padding: '10px', borderRadius: '10px', background: '#111c2b', border: '1px solid #223449', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{song.track_name}</div>
                  <div style={{ color: '#9fb0c3', fontSize: '13px' }}>
                    {song.artist_name || 'Artista desconhecido'} • Prioridade: {song.priority ?? 0}
                  </div>
                </div>
                {user?.role && ['admin', 'moderator'].includes(user.role) && (
                  <button onClick={() => openBanSongModal(song)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#ff5c5c', color: 'white', cursor: 'pointer', marginLeft: '10px', flexShrink: 0 }}>
                    Remover
                  </button>
                )}
              </div>
            ))
          ) : (
            <div style={{ color: '#9fb0c3' }}>Nenhuma música na fila ainda.</div>
          )}
        </div>
      </section>

      {/* Modal de Banimento */}
      {
        banModal.type && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 50 }}>
            <div style={{ width: '100%', maxWidth: '420px', background: '#0f1b2d', border: '2px solid #ff5c5c', borderRadius: '20px', padding: '24px', position: 'relative' }}>
              <button type="button" onClick={closeBanModal} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#9fb0c3', cursor: 'pointer', fontSize: '24px' }}>×</button>

              <h3 style={{ marginTop: 0, color: '#ff5c5c' }}>
                {banModal.type === 'member' ? 'Remover e Banir Membro' : 'Remover Música'}
              </h3>

              <div style={{ background: '#111c2b', padding: '12px', borderRadius: '10px', border: '1px solid #223449', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#9fb0c3', marginBottom: '4px' }}>Alvo:</div>
                <div style={{ fontWeight: 700 }}>{banModal.targetName}</div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9fb0c3', fontSize: '14px' }}>
                  Motivo da remoção:
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder={banModal.type === 'member' ? 'Ex: Comportamento inadequado' : 'Ex: Música não apropriada para a playlist'}
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #223449', background: '#111c2b', color: 'white', fontFamily: 'inherit' }}
                />
              </div>

              {banModal.type === 'member' && (
                <div style={{ background: '#1a2a3a', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#9fb0c3', border: '1px solid #223449' }}>
                  ⚠️ O membro será removido e banido da playlist. Ele não poderá entrar novamente.
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleBanConfirm}
                  disabled={isProcessing}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#ff5c5c', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                >
                  {isProcessing ? 'Removendo...' : 'Confirmar Remoção'}
                </button>
                <button
                  type="button"
                  onClick={closeBanModal}
                  disabled={isProcessing}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white', cursor: 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
