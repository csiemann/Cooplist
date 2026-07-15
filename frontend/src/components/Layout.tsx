import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { getPlaylists, createPlaylist } from '../services/api';
import type { Playlist } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const { playlists, setPlaylists, selectedPlaylist, selectPlaylist } = usePlaylistStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    setCreateError('');

    if (!name.trim()) return;

    try {
      const res = await createPlaylist({ name, description });
      const newPlaylist = res.data.playlist as Playlist;
      const nextPlaylists = [newPlaylist, ...playlists];
      setPlaylists(nextPlaylists);
      selectPlaylist(newPlaylist);
      setName('');
      setDescription('');
      setShowCreateModal(false);
    } catch (error: any) {
      setCreateError(error?.response?.data?.error || 'Falha ao criar playlist');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07111f', color: '#f5f7fb' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid #1f2a3a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.24em', color: '#63d3ff' }}>Cooplist</div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', color: '#9fb0c3', fontSize: '14px' }}>
            <span>{user?.name}</span>
            <span style={{ color: '#63d3ff', textTransform: 'uppercase', fontSize: '12px' }}>{user?.role || 'user'}</span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #2f455b', background: '#111c2b', color: 'white', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 'calc(100vh - 80px)' }}>
        <aside style={{ padding: '20px', borderRight: '1px solid #1f2a3a', background: '#0b1624' }}>
          <h2 style={{ marginTop: 0, fontSize: '16px' }}>Playlists</h2>
          {user?.role && ['admin', 'moderator'].includes(user.role) ? (
            <>
              <button type="button" onClick={() => setShowCreateModal(true)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer', marginBottom: '16px' }}>
                Nova playlist
              </button>
              {createError && <div style={{ color: '#ff7a7a', fontSize: '13px', marginBottom: '16px' }}>{createError}</div>}
            </>
          ) : (
            <div style={{ marginBottom: '16px', color: '#9fb0c3', fontSize: '14px', lineHeight: '1.5' }}>
              
            </div>
          )}

          <div style={{ display: 'grid', gap: '8px' }}>
            {playlists.map((playlist) => (
              <button key={playlist.id} onClick={() => selectPlaylist(playlist)} style={{ textAlign: 'left', padding: '12px', borderRadius: '10px', border: selectedPlaylist?.id === playlist.id ? '1px solid #1db954' : '1px solid #223449', background: selectedPlaylist?.id === playlist.id ? '#16253b' : '#111c2b', color: 'white', cursor: 'pointer' }}>
                <div style={{ fontWeight: 700 }}>{playlist.name}</div>
                <div style={{ fontSize: '12px', color: '#8ea3b8' }}>{playlist.song_count ?? 0} músicas • {playlist.member_count ?? 0} membros</div>
              </button>
            ))}
          </div>
          {showCreateModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 50 }}>
              <div style={{ width: '100%', maxWidth: '420px', background: '#0f1b2d', border: '1px solid #223449', borderRadius: '20px', padding: '24px', position: 'relative' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#9fb0c3', cursor: 'pointer', fontSize: '18px' }}>×</button>
                <h3 style={{ marginTop: 0 }}>Nova playlist</h3>
                <form onSubmit={handleCreate} style={{ display: 'grid', gap: '14px' }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da playlist" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white' }} />
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" rows={4} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white' }} />
                  {createError && <div style={{ color: '#ff7a7a' }}>{createError}</div>}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer' }}>Criar</button>
                    <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </aside>

        <main style={{ padding: '24px' }}>{children}</main>
      </div>
    </div>
  );
}
