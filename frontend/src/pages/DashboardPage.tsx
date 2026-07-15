import { useEffect, useState } from 'react';
import { getPlaylistDetails, getAnalytics, addSongToPlaylist, searchSpotify } from '../services/api';
import { initSocket, joinPlaylistRoom, leavePlaylistRoom } from '../stores/playlistStore';
import { useAuthStore } from '../stores/authStore';
import PlaylistDetails from '../components/PlaylistDetails';
import AnalyticsChart from '../components/AnalyticsChart';
import { usePlaylistStore } from '../stores/playlistStore';
import type { AnalyticsStats, Song } from '../types';

export default function DashboardPage() {
  const { selectedPlaylist, songs, setSongs } = usePlaylistStore();
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingTrack, setAddingTrack] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { user } = useAuthStore();
  useEffect(() => {
    initSocket();

    if (!selectedPlaylist) return;
    // Join playlist room so socket events update UI in realtime
    joinPlaylistRoom(selectedPlaylist.id, user?.id);
    loadPlaylistData();

    return () => {
      if (selectedPlaylist) leavePlaylistRoom(selectedPlaylist.id, user?.id);
    };
  }, [selectedPlaylist]);

  const loadPlaylistData = async () => {
    if (!selectedPlaylist) return;
    setLoading(true);
    setError('');

    try {
      const [playlistRes, analyticsRes] = await Promise.all([
        getPlaylistDetails(selectedPlaylist.id),
        getAnalytics(selectedPlaylist.id)
      ]);

      // Backend retorna { playlist, members, songs, user_role }
      const details = playlistRes.data;
      setSongs(details.songs || [] as Song[]);
      
      // Analytics retorna { playlist, stats { total_songs, total_members, ... } }
      const analyticsData = analyticsRes.data?.stats || analyticsRes.data;
      setAnalytics(analyticsData as AnalyticsStats);
    } catch (err: any) {
      console.error('Error loading playlist:', err);
      setError('Erro ao carregar dados da playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchLoading(true);
    setError('');

    try {
      const res = await searchSpotify(query, 8);
      setSearchResults(res.data.results || []);
    } catch (err) {
      setError('Erro ao buscar músicas');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddSong = async (track: any) => {
    if (!selectedPlaylist) return;

    setAddingTrack(track.id);
    setError('');
    setSuccess('');

    try {
      await addSongToPlaylist(selectedPlaylist.id, {
        spotify_track_id: track.id,
        track_name: track.name,
        artist_name: track.artist,
        track_duration_ms: track.duration_ms || 0,
        priority: 0,
      });

      // Recarregar dados da playlist para sincronizar
      await loadPlaylistData();
      setSuccess(`"${track.name}" adicionada à playlist`);

      // Limpar sucesso após 3 segundos
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao adicionar música');
    } finally {
      setAddingTrack(null);
    }
  };

  if (!selectedPlaylist) {
    return <div style={{ color: '#9fb0c3' }}>Selecione ou crie uma playlist.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {error && (
        <div style={{ background: '#632a2a', border: '1px solid #ff7a7a', color: '#ff7a7a', padding: '12px', borderRadius: '8px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#1a472b', border: '1px solid #63d3ff', color: '#63d3ff', padding: '12px', borderRadius: '8px' }}>
          ✓ {success}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
        <div>
          <div style={{ color: '#63d3ff', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Playlist selecionada</div>
          <h2 style={{ margin: '4px 0' }}>{selectedPlaylist.name}</h2>
          <p style={{ color: '#9fb0c3', margin: 0 }}>{selectedPlaylist.description || 'Sem descrição'}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '12px', width: '100%', maxWidth: '520px' }}>
          <div style={{ background: '#0f1b2d', padding: '16px', borderRadius: '16px', border: '1px solid #223449' }}>
            <div style={{ fontSize: '12px', color: '#63d3ff', marginBottom: '6px' }}>Músicas na fila</div>
            <div style={{ fontSize: '22px', fontWeight: 700 }}>{analytics?.total_songs ?? 0}</div>
          </div>
          <div style={{ background: '#0f1b2d', padding: '16px', borderRadius: '16px', border: '1px solid #223449' }}>
            <div style={{ fontSize: '12px', color: '#63d3ff', marginBottom: '6px' }}>Membros ativos</div>
            <div style={{ fontSize: '22px', fontWeight: 700 }}>{analytics?.total_members ?? 0}</div>
          </div>
          <div style={{ background: '#0f1b2d', padding: '16px', borderRadius: '16px', border: '1px solid #223449' }}>
            <div style={{ fontSize: '12px', color: '#63d3ff', marginBottom: '6px' }}>Duração total</div>
            <div style={{ fontSize: '22px', fontWeight: 700 }}>{analytics?.total_duration_hours ?? 0}h</div>
            <div style={{ fontSize: '22px', fontWeight: 700 }}>{analytics?.total_duration_minutes ?? 0}min</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
          <h3 style={{ marginTop: 0 }}>Fila atual</h3>
          {loading ? (
            <div style={{ color: '#9fb0c3' }}>Carregando...</div>
          ) : songs.length ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {songs.map((song, index) => (
                <div key={song.id} style={{ padding: '14px', borderRadius: '12px', background: '#111c2b', border: '1px solid #223449' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ background: '#1db954', color: 'black', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{song.track_name}</div>
                      <div style={{ color: '#9fb0c3', fontSize: '13px', marginTop: '4px' }}>
                        {song.artist_name || 'Artista desconhecido'} • {song.added_by_name || 'Usuário'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9fb0c3' }}>Nenhuma música na fila ainda.</div>
          )}
        </section>

        <aside style={{ display: 'grid', gap: '20px' }}>
          <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
            <h3 style={{ marginTop: 0 }}>Analytics detalhada</h3>
            {analytics ? (
              <AnalyticsChart songsByUser={analytics.songs_by_user} />
            ) : (
              <div style={{ color: '#9fb0c3' }}>Sem dados de analytics disponíveis.</div>
            )}
          </section>
        </aside>
      </div>

      <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Buscar no Spotify</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar música, artista..."
            style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white' }}
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            style={{ padding: '12px 16px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer', opacity: searchLoading ? 0.6 : 1 }}
          >
            {searchLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {searchResults.length ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {searchResults.map((track) => (
              <div
                key={track.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '12px', background: '#111c2b', border: '1px solid #223449' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{track.name}</div>
                  <div style={{ color: '#9fb0c3', fontSize: '13px' }}>{track.artist || track.artists?.join(', ') || 'Artista desconhecido'}</div>
                </div>
                <button
                  onClick={() => handleAddSong(track)}
                  disabled={addingTrack === track.id}
                  style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', cursor: 'pointer', opacity: addingTrack === track.id ? 0.6 : 1, marginLeft: '10px', flexShrink: 0 }}
                >
                  {addingTrack === track.id ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#9fb0c3' }}>{searchLoading ? 'Buscando resultados...' : 'Nenhuma busca realizada ainda.'}</div>
        )}
      </section>

      <PlaylistDetails playlist={selectedPlaylist} songs={songs} />
    </div>
  );
}
