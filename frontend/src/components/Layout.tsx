import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { getPlaylists, createPlaylist } from '../services/api';
import { useToast } from './Toast';
import FavoritesModal from './FavoritesModal';
import type { Playlist } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const { playlists, setPlaylists, selectedPlaylist, selectPlaylist } = usePlaylistStore();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    getPlaylists()
      .then((res) => {
        const data = res.data as Playlist[];
        setPlaylists(data);
        if (!selectedPlaylist && data[0]) {
          selectPlaylist(data[0]);
        }
      })
      .catch(() => {
        setPlaylists([]);
      });
  }, [user, navigate, selectedPlaylist, selectPlaylist, setPlaylists]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showError('Nome da playlist é obrigatório');
      return;
    }

    try {
      const res = await createPlaylist({ name, description });
      const newPlaylist = res.data.playlist as Playlist;
      const nextPlaylists = [newPlaylist, ...playlists];
      setPlaylists(nextPlaylists);
      selectPlaylist(newPlaylist);
      setName('');
      setDescription('');
      setShowCreateModal(false);
      setMobileSidebarOpen(false);
      showSuccess(`Playlist "${name}" criada com sucesso!`);
    } catch (error: any) {
      showError(error?.response?.data?.error || 'Falha ao criar playlist');
    }
  };

  const handleSelectPlaylistMobile = (playlist: Playlist) => {
    selectPlaylist(playlist);
    setMobileSidebarOpen(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07111f', color: '#f5f7fb' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #1f2a3a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#07111f', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            title="Alternar Menu de Playlists"
          >
            ☰
          </button>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.24em', color: '#63d3ff', fontWeight: 700 }}>Cooplist</div>
            <h1 style={{ margin: 0, fontSize: '20px' }}>Dashboard</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', color: '#9fb0c3', fontSize: '13px' }}>
            <span style={{ fontWeight: 700, color: '#f5f7fb' }}>{user?.name}</span>
            <span style={{ color: '#63d3ff', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>{user?.role || 'member'}</span>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #2f455b', background: '#111c2b', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            Sair
          </button>
        </div>
      </header>

      {mobileSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <div className="layout-container">
        <aside className={`layout-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
          <button
            type="button"
            onClick={() => {
              setShowFavoritesModal(true);
              setMobileSidebarOpen(false);
            }}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ec4899', background: '#1d0d21', color: '#ec4899', fontWeight: 700, cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}
          >
            ❤️ Meus Favoritos
          </button>

          <h2 style={{ marginTop: 0, fontSize: '16px', color: '#63d3ff', letterSpacing: '0.05em' }}>Minhas Playlists</h2>
          {user?.role && ['admin', 'moderator'].includes(user.role) && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer', marginBottom: '16px' }}
            >
              + Nova playlist
            </button>
          )}

          <div style={{ display: 'grid', gap: '8px' }}>
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => handleSelectPlaylistMobile(playlist)}
                style={{
                  textAlign: 'left',
                  padding: '12px',
                  borderRadius: '10px',
                  border: selectedPlaylist?.id === playlist.id ? '1px solid #1db954' : '1px solid #223449',
                  background: selectedPlaylist?.id === playlist.id ? '#16253b' : '#111c2b',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontWeight: 700 }}>{playlist.name}</div>
                <div style={{ fontSize: '12px', color: '#8ea3b8', marginTop: '2px' }}>
                  {playlist.song_count ?? 0} músicas • {playlist.member_count ?? 0} membros
                </div>
              </button>
            ))}
          </div>

          <FavoritesModal isOpen={showFavoritesModal} onClose={() => setShowFavoritesModal(false)} />

          {showCreateModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 150 }}>
              <div style={{ width: '100%', maxWidth: '420px', background: '#0f1b2d', border: '1px solid #223449', borderRadius: '20px', padding: '24px', position: 'relative' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#9fb0c3', cursor: 'pointer', fontSize: '22px' }}>×</button>
                <h3 style={{ marginTop: 0, color: '#f5f7fb' }}>Nova playlist</h3>
                <form onSubmit={handleCreate} style={{ display: 'grid', gap: '14px' }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da playlist" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white' }} />
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" rows={3} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white' }} />
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer' }}>Criar</button>
                    <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </aside>

        <main className="layout-main">{children}</main>
      </div>
    </div>
  );
}
