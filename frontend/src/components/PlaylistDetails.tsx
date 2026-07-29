import { useEffect, useState } from 'react';
import {
  getMembers,
  createInviteLink,
  getInviteLinks,
  deleteInviteLink,
  removeMember,
  banMember,
  removeSongFromPlaylist,
  banSong
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { usePlaylistStore, initSocket } from '../stores/playlistStore';
import { useToast } from './Toast';
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
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [banModal, setBanModal] = useState<BanModal>({ type: null, targetId: null, targetName: '' });
  const [banReason, setBanReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuthStore();
  const { setSongs } = usePlaylistStore();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    // Reset inviteLink ao mudar de playlist
    setInviteLink('');
    loadMembers();
    loadInvites();

    const socket = initSocket();
    const handleRefresh = () => {
      loadMembers();
      loadInvites();
    };

    socket?.on('member_joined', handleRefresh);
    socket?.on('member_removed', handleRefresh);
    socket?.on('member_banned', handleRefresh);
    socket?.on('invite_created', handleRefresh);
    socket?.on('invite_revoked', handleRefresh);

    return () => {
      socket?.off('member_joined', handleRefresh);
      socket?.off('member_removed', handleRefresh);
      socket?.off('member_banned', handleRefresh);
      socket?.off('invite_created', handleRefresh);
      socket?.off('invite_revoked', handleRefresh);
    };
  }, [playlist.id]);

  const loadMembers = async () => {
    try {
      const res = await getMembers(playlist.id);
      setMembers(res.data || []);
    } catch {
      setMembers([]);
    }
  };

  const loadInvites = async () => {
    try {
      const res = await getInviteLinks(playlist.id);
      setInvites(res.data || []);
    } catch {
      setInvites([]);
    }
  };

  const handleCreateLink = async () => {
    setInviteLink('');

    try {
      const res = await createInviteLink(playlist.id, { role: 'member' });
      setInviteLink(res.data.link);
      showSuccess('Link de convite multiuso gerado!');
      loadInvites();
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Falha ao gerar link de convite');
    }
  };

  const handleRevokeInvite = async (inviteId: number) => {
    try {
      await deleteInviteLink(playlist.id, inviteId);
      showSuccess('Link de convite desativado com sucesso');
      loadInvites();
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Falha ao desativar convite');
    }
  };

  const handleRemoveMemberSimple = async (member: any) => {
    if (!window.confirm(`Deseja remover "${member.name}" da playlist? (Ele poderá retornar através de um link de convite)`)) {
      return;
    }

    try {
      await removeMember(playlist.id, member.id);
      showSuccess(`Membro "${member.name}" removido da playlist`);
      loadMembers();
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Falha ao remover membro');
    }
  };

  const handleRemoveSongSimple = async (song: Song) => {
    try {
      await removeSongFromPlaylist(playlist.id, song.id);
      showSuccess(`Música "${song.track_name}" removida da fila`);
      setSongs(songs.filter(s => s.id !== song.id));
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Falha ao remover música');
    }
  };

  const openBanMemberModal = (member: any) => {
    if (playlist.created_by === member.id) {
      showError('Não é possível banir o dono da playlist');
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

    try {
      if (banModal.type === 'member') {
        await banMember(playlist.id, banModal.targetId, banReason);
        showSuccess(`Membro "${banModal.targetName}" banido permanentemente`);
        loadMembers();
      } else if (banModal.type === 'song') {
        await banSong(playlist.id, banModal.targetId);
        showSuccess(`Música "${banModal.targetName}" banida permanentemente desta playlist`);
        setSongs(songs.filter(s => s.id !== banModal.targetId));
      }
      closeBanModal();
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Falha ao processar banimento');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeBanModal = () => {
    setBanModal({ type: null, targetId: null, targetName: '' });
    setBanReason('');
  };

  // Privilégios de Dono / Moderador / Admin
  const isUserAdminOrOwner = playlist.created_by === user?.id || (user?.role && ['admin', 'moderator', 'owner'].includes(user.role));

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
        <h3 style={{ marginTop: 0, fontSize: '18px' }}>Membros da Playlist</h3>

        {isUserAdminOrOwner ? (
          <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCreateLink}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                + Gerar link de convite multiuso
              </button>
            </div>
            {inviteLink && (
              <div style={{ background: '#111c2b', padding: '12px', borderRadius: '10px', border: '1px solid #223449', wordBreak: 'break-all' }}>
                <strong style={{ color: '#63d3ff' }}>Novo link gerado (multiuso):</strong>
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, fontSize: '13px', minWidth: '180px' }}>{inviteLink}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      showSuccess('Link copiado para a área de transferência!');
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#9fb0c3', marginBottom: '12px' }}>Somente Administradores, Moderadores ou Donos podem convidar e gerenciar membros.</div>
        )}

        {/* Listagem de links de convite ativos */}
        {isUserAdminOrOwner && invites.length > 0 && (
          <div style={{ background: '#111c2b', border: '1px solid #223449', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#63d3ff', fontSize: '14px' }}>Links de convite ativos ({invites.length})</h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              {invites.map((inv) => {
                const frontendBaseUrl = window.location.origin;
                const fullLink = `${frontendBaseUrl}/join/${inv.token}`;
                return (
                  <div key={inv.id} style={{ background: '#0f1b2d', padding: '10px', borderRadius: '8px', border: '1px solid #223449', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, wordBreak: 'break-all' }}>{fullLink}</div>
                      <div style={{ fontSize: '12px', color: '#9fb0c3', marginTop: '2px' }}>
                        Usos: <strong>{inv.uses || 0}</strong> {inv.max_uses ? `/ ${inv.max_uses}` : '(Multiuso)'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(fullLink);
                          showSuccess('Link copiado!');
                        }}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Copiar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeInvite(inv.id)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: '#ef4444', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Desativar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: '8px' }}>
          {members.map((member) => {
            const isOwner = playlist.created_by === member.id || member.role === 'admin' || member.role === 'owner';
            const isCurrentUser = user?.id === member.id;

            return (
              <div key={member.id} style={{ padding: '12px', borderRadius: '10px', background: '#111c2b', border: '1px solid #223449', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {member.name}
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: isOwner ? '#3b82f6' : '#223449', color: 'white', fontWeight: 700 }}>
                      {isOwner ? 'Dono / Admin' : 'Membro'}
                    </span>
                  </div>
                  <div style={{ color: '#9fb0c3', fontSize: '13px', marginTop: '2px' }}>{member.email}</div>
                </div>

                {isUserAdminOrOwner && !isOwner && !isCurrentUser && (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveMemberSimple(member)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'black', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                      title="Remove da playlist (membro poderá entrar novamente via convite)"
                    >
                      Remover
                    </button>
                    <button
                      type="button"
                      onClick={() => openBanMemberModal(member)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                      title="Bane permanentemente a conta da playlist"
                    >
                      Banir
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
        <h3 style={{ marginTop: 0, fontSize: '18px' }}>Gerenciamento da Fila de Músicas</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {songs.length > 0 ? (
            songs.map((song) => (
              <div key={song.id} style={{ padding: '10px', borderRadius: '10px', background: '#111c2b', border: '1px solid #223449', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.track_name}</div>
                  <div style={{ color: '#9fb0c3', fontSize: '13px' }}>
                    {song.artist_name || 'Artista desconhecido'} • por {song.added_by_name || 'Membro'}
                  </div>
                </div>
                {isUserAdminOrOwner && (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleRemoveSongSimple(song)}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'black', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                      title="Remove a música da fila atual"
                    >
                      Remover
                    </button>
                    <button
                      onClick={() => openBanSongModal(song)}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                      title="Proíbe esta música de ser adicionada à playlist no futuro"
                    >
                      Banir
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ color: '#9fb0c3' }}>Nenhuma música na fila ainda.</div>
          )}
        </div>
      </section>

      {/* Modal de Banimento */}
      {banModal.type && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 150 }}>
          <div style={{ width: '100%', maxWidth: '420px', background: '#0f1b2d', border: '2px solid #ef4444', borderRadius: '20px', padding: '24px', position: 'relative' }}>
            <button type="button" onClick={closeBanModal} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#9fb0c3', cursor: 'pointer', fontSize: '24px' }}>×</button>

            <h3 style={{ marginTop: 0, color: '#ef4444' }}>
              {banModal.type === 'member' ? 'Banir Membro da Playlist' : 'Banir Música da Playlist'}
            </h3>

            <div style={{ background: '#111c2b', padding: '12px', borderRadius: '10px', border: '1px solid #223449', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#9fb0c3', marginBottom: '4px' }}>Alvo:</div>
              <div style={{ fontWeight: 700 }}>{banModal.targetName}</div>
            </div>

            {banModal.type === 'member' ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#9fb0c3', fontSize: '13px' }}>
                    Motivo do banimento:
                  </label>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Ex: Violação das regras da playlist"
                    rows={3}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #223449', background: '#111c2b', color: 'white', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ background: '#3b1c1c', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#f87171', border: '1px solid #7f1d1d' }}>
                  🚫 O membro será <strong>banido permanentemente</strong> e todas as suas músicas serão removidas da playlist.
                </div>
              </>
            ) : (
              <div style={{ background: '#3b1c1c', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#f87171', border: '1px solid #7f1d1d' }}>
                🚫 Esta música será removida e <strong>proibida de ser adicionada novamente</strong> a esta playlist.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleBanConfirm}
                disabled={isProcessing}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: isProcessing ? 0.6 : 1 }}
              >
                {isProcessing ? 'Processando...' : 'Confirmar Banimento'}
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
      )}
    </div>
  );
}
