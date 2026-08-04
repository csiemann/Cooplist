import { useEffect, useState, useRef } from 'react';
import { getPlaylistDetails, getAnalytics, getPlaylistVersion, getPlaylists, addSongToPlaylist, searchSpotify, getFavorites, addFavorite, removeFavoriteByTrackId } from '../services/api';
import { initSocket, joinPlaylistRoom, leavePlaylistRoom } from '../stores/playlistStore';
import { useAuthStore } from '../stores/authStore';
import { useToast } from '../components/Toast';
import PlaylistDetails from '../components/PlaylistDetails';
import AnalyticsChart from '../components/AnalyticsChart';
import { usePlaylistStore } from '../stores/playlistStore';
import type { AnalyticsStats, Song, Favorite } from '../types';

export default function DashboardPage() {
  const { selectedPlaylist, songs, setSongs, setPlaylists } = usePlaylistStore();
  const { showSuccess, showError } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [userFavorites, setUserFavorites] = useState<Favorite[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingTrack, setAddingTrack] = useState<string | null>(null);
  const currentVersionRef = useRef<string | null>(null);

  const { user } = useAuthStore();

  const fetchAnalyticsData = async (playlistId: number) => {
    try {
      const analyticsRes = await getAnalytics(playlistId);
      const analyticsData = analyticsRes.data?.stats || analyticsRes.data;
      setAnalytics(analyticsData as AnalyticsStats);
    } catch (analyticsErr) {
      console.warn('Analytics error:', analyticsErr);
      setAnalytics(null);
    }
  };

  const fetchPlaylistsData = async () => {
    try {
      const res = await getPlaylists();
      setPlaylists(res.data || []);
    } catch {}
  };

  const loadUserFavorites = async () => {
    try {
      const res = await getFavorites();
      setUserFavorites(res.data || []);
    } catch {
      setUserFavorites([]);
    }
  };

  const handleToggleFavoriteTrack = async (track: {
    spotify_track_id: string;
    track_name: string;
    artist_name: string;
    track_duration_ms?: number;
  }) => {
    const isFav = userFavorites.some(f => f.spotify_track_id === track.spotify_track_id);
    try {
      if (isFav) {
        await removeFavoriteByTrackId(track.spotify_track_id);
        setUserFavorites(prev => prev.filter(f => f.spotify_track_id !== track.spotify_track_id));
        showSuccess(`"${track.track_name}" removida dos favoritos`);
      } else {
        await addFavorite({
          spotify_track_id: track.spotify_track_id,
          track_name: track.track_name,
          artist_name: track.artist_name,
          track_duration_ms: track.track_duration_ms || 0
        });
        showSuccess(`"${track.track_name}" adicionada aos favoritos!`);
        await loadUserFavorites();
      }
    } catch {
      showError('Erro ao atualizar favoritos');
    }
  };

  useEffect(() => {
    loadUserFavorites();
  }, [user]);

  useEffect(() => {
    const socket = initSocket();

    if (!selectedPlaylist) return;
    joinPlaylistRoom(selectedPlaylist.id, user?.id);
    loadPlaylistData();

    const handleAnalyticsUpdate = () => {
      fetchAnalyticsData(selectedPlaylist.id);
      fetchPlaylistsData();
    };

    socket?.on('analytics_updated', handleAnalyticsUpdate);
    socket?.on('song_added', handleAnalyticsUpdate);
    socket?.on('song_removed', handleAnalyticsUpdate);
    socket?.on('member_joined', handleAnalyticsUpdate);
    socket?.on('member_removed', handleAnalyticsUpdate);
    socket?.on('member_banned', handleAnalyticsUpdate);

    const observerInterval = setInterval(async () => {
      if (!selectedPlaylist) return;
      try {
        const verRes = await getPlaylistVersion(selectedPlaylist.id);
        const newVersion = verRes.data?.version;
        if (currentVersionRef.current !== null && newVersion && newVersion !== currentVersionRef.current) {
          console.log(`[5s Observer] Playlist ${selectedPlaylist.id} alterada (${currentVersionRef.current} -> ${newVersion}). Atualizando dados...`);
          currentVersionRef.current = newVersion;
          await loadPlaylistData();
        }
      } catch (err) {
        // Silencioso em falhas temporárias de rede no observador
      }
    }, 5000);

    return () => {
      clearInterval(observerInterval);
      socket?.off('analytics_updated', handleAnalyticsUpdate);
      socket?.off('song_added', handleAnalyticsUpdate);
      socket?.off('song_removed', handleAnalyticsUpdate);
      socket?.off('member_joined', handleAnalyticsUpdate);
      socket?.off('member_removed', handleAnalyticsUpdate);
      socket?.off('member_banned', handleAnalyticsUpdate);
      if (selectedPlaylist) leavePlaylistRoom(selectedPlaylist.id, user?.id);
    };
  }, [selectedPlaylist]);

  const loadPlaylistData = async () => {
    if (!selectedPlaylist) return;
    setLoading(true);

    try {
      const playlistRes = await getPlaylistDetails(selectedPlaylist.id);
      const details = playlistRes.data;
      setSongs(details.songs || ([] as Song[]));

      await fetchAnalyticsData(selectedPlaylist.id);
      await fetchPlaylistsData();

      try {
        const verRes = await getPlaylistVersion(selectedPlaylist.id);
        currentVersionRef.current = verRes.data?.version || null;
      } catch {}
    } catch (err: any) {
      console.error('Error loading playlist:', err);
      if (err?.response?.status === 403) {
        showError('Você não tem mais acesso a esta playlist');
        const { selectPlaylist } = usePlaylistStore.getState();
        selectPlaylist(null);
        fetchPlaylistsData();
      } else {
        showError('Erro ao carregar dados da playlist');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchLoading(true);

    try {
      const res = await searchSpotify(query, 8);
      setSearchResults(res.data.results || []);
    } catch (err) {
      showError('Erro ao buscar músicas no Spotify');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddSong = async (track: any) => {
    if (!selectedPlaylist) return;

    setAddingTrack(track.id);

    try {
      await addSongToPlaylist(selectedPlaylist.id, {
        spotify_track_id: track.id,
        track_name: track.name,
        artist_name: track.artist,
        track_duration_ms: track.duration_ms || 0,
        priority: 0,
      });

      await loadPlaylistData();
      showSuccess(`Música "${track.name}" adicionada à playlist!`);
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Erro ao adicionar música');
    } finally {
      setAddingTrack(null);
    }
  };

  if (!selectedPlaylist) {
    return <div style={{ color: '#9fb0c3', padding: '24px' }}>Selecione ou crie uma playlist no menu lateral.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div className="dashboard-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
        <div>
          <div style={{ color: '#63d3ff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700 }}>Playlist selecionada</div>
          <h2 style={{ margin: '4px 0', fontSize: '24px' }}>{selectedPlaylist.name}</h2>
          <p style={{ color: '#9fb0c3', margin: 0, fontSize: '14px' }}>{selectedPlaylist.description || 'Sem descrição'}</p>
        </div>

        <div className="dashboard-stats-grid">
          <div style={{ background: '#0f1b2d', padding: '14px 16px', borderRadius: '14px', border: '1px solid #223449' }}>
            <div style={{ fontSize: '12px', color: '#63d3ff', marginBottom: '4px', fontWeight: 600 }}>Músicas</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{analytics?.total_songs ?? 0}</div>
          </div>
          <div style={{ background: '#0f1b2d', padding: '14px 16px', borderRadius: '14px', border: '1px solid #223449' }}>
            <div style={{ fontSize: '12px', color: '#63d3ff', marginBottom: '4px', fontWeight: 600 }}>Membros</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{analytics?.total_members ?? 0}</div>
          </div>
          <div style={{ background: '#0f1b2d', padding: '14px 16px', borderRadius: '14px', border: '1px solid #223449' }}>
            <div style={{ fontSize: '12px', color: '#63d3ff', marginBottom: '4px', fontWeight: 600 }}>Duração</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              {analytics?.total_duration_hours ? `${analytics.total_duration_hours}h ` : ''}
              {analytics?.total_duration_minutes ?? 0}m
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-main">
        <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
          <h3 style={{ marginTop: 0, fontSize: '18px' }}>Fila de reprodução</h3>
          {loading ? (
            <div style={{ color: '#9fb0c3', padding: '12px 0' }}>Carregando fila...</div>
          ) : songs.length ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {songs.map((song, index) => (
                <div key={song.id} style={{ padding: '12px', borderRadius: '12px', background: '#111c2b', border: '1px solid #223449' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ background: '#1db954', color: 'black', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, minWidth: '24px', textAlign: 'center', marginTop: '2px' }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.track_name}</div>
                      <div style={{ color: '#9fb0c3', fontSize: '13px', marginTop: '2px' }}>
                        {song.artist_name || 'Artista desconhecido'} • por {song.added_by_name || 'Usuário'}
                      </div>
                    </div>
                    {song.spotify_track_id && (
                      <button
                        type="button"
                        onClick={() => handleToggleFavoriteTrack({
                          spotify_track_id: song.spotify_track_id!,
                          track_name: song.track_name,
                          artist_name: song.artist_name || 'Artista desconhecido',
                          track_duration_ms: song.track_duration_ms || 0
                        })}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
                        title={userFavorites.some(f => f.spotify_track_id === song.spotify_track_id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                      >
                        {userFavorites.some(f => f.spotify_track_id === song.spotify_track_id) ? '❤️' : '🤍'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9fb0c3', padding: '12px 0' }}>Nenhuma música na fila ainda.</div>
          )}
        </section>

        <aside style={{ display: 'grid', gap: '20px' }}>
          <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
            <h3 style={{ marginTop: 0, fontSize: '18px' }}>Estatísticas dos Membros</h3>
            {analytics ? (
              <AnalyticsChart songsByUser={analytics.songs_by_user} />
            ) : (
              <div style={{ color: '#9fb0c3' }}>Sem dados estatísticos disponíveis.</div>
            )}
          </section>
        </aside>
      </div>

      <section style={{ background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '16px' }}>
        <h3 style={{ marginTop: 0, fontSize: '18px' }}>Buscar no Spotify</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar música, artista..."
            style={{ flex: '1 1 200px', padding: '12px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white' }}
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            style={{ flex: '0 0 auto', padding: '12px 20px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer', opacity: searchLoading ? 0.6 : 1 }}
          >
            {searchLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {searchResults.length ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {searchResults.map((track) => (
              <div
                key={track.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '12px', background: '#111c2b', border: '1px solid #223449', gap: '10px', flexWrap: 'wrap' }}
              >
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ fontWeight: 700 }}>{track.name}</div>
                  <div style={{ color: '#9fb0c3', fontSize: '13px' }}>{track.artist || track.artists?.join(', ') || 'Artista desconhecido'}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleFavoriteTrack({
                      spotify_track_id: track.id,
                      track_name: track.name,
                      artist_name: track.artist || track.artists?.join(', ') || 'Artista desconhecido',
                      track_duration_ms: track.duration_ms || 0
                    })}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 6px' }}
                    title={userFavorites.some(f => f.spotify_track_id === track.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                  >
                    {userFavorites.some(f => f.spotify_track_id === track.id) ? '❤️' : '🤍'}
                  </button>
                  <button
                    onClick={() => handleAddSong(track)}
                    disabled={addingTrack === track.id}
                    style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer', opacity: addingTrack === track.id ? 0.6 : 1, flexShrink: 0 }}
                  >
                    {addingTrack === track.id ? 'Adicionando...' : '+ Adicionar'}
                  </button>
                </div>
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
