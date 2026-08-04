import { useEffect, useState } from 'react';
import { getFavorites, addFavorite, removeFavoriteByTrackId, searchSpotify, addSongToPlaylist } from '../services/api';
import { usePlaylistStore } from '../stores/playlistStore';
import { useToast } from './Toast';
import type { Favorite } from '../types';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FavoritesModal({ isOpen, onClose }: FavoritesModalProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);

  const { selectedPlaylist, setSongs, songs } = usePlaylistStore();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadFavorites();
    }
  }, [isOpen]);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const res = await getFavorites();
      setFavorites(res.data || []);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  const isFavorited = (trackId: string) => {
    return favorites.some(f => f.spotify_track_id === trackId);
  };

  const handleToggleFavorite = async (track: {
    spotify_track_id: string;
    track_name: string;
    artist_name: string;
    track_duration_ms?: number;
  }) => {
    const favorited = isFavorited(track.spotify_track_id);

    try {
      if (favorited) {
        await removeFavoriteByTrackId(track.spotify_track_id);
        setFavorites(favorites.filter(f => f.spotify_track_id !== track.spotify_track_id));
        showSuccess(`"${track.track_name}" removida dos favoritos`);
      } else {
        await addFavorite({
          spotify_track_id: track.spotify_track_id,
          track_name: track.track_name,
          artist_name: track.artist_name,
          track_duration_ms: track.track_duration_ms || 0
        });
        showSuccess(`"${track.track_name}" adicionada aos favoritos!`);
        await loadFavorites();
      }
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Erro ao atualizar favoritos');
    }
  };

  const handleSearchSpotify = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await searchSpotify(searchQuery, 6);
      setSearchResults(res.data.results || []);
    } catch {
      showError('Erro ao pesquisar músicas no Spotify');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddFavoriteToPlaylist = async (fav: Favorite) => {
    if (!selectedPlaylist) {
      showError('Selecione uma playlist no menu lateral para adicionar a música.');
      return;
    }

    setAddingTrackId(fav.spotify_track_id);
    try {
      await addSongToPlaylist(selectedPlaylist.id, {
        spotify_track_id: fav.spotify_track_id,
        track_name: fav.track_name,
        artist_name: fav.artist_name,
        track_duration_ms: fav.track_duration_ms || 0,
        priority: 0,
      });

      showSuccess(`"${fav.track_name}" adicionada à playlist "${selectedPlaylist.name}"!`);
      // Update store if songs exist
      if (songs) {
        setSongs([...songs, {
          id: Date.now(),
          playlist_id: selectedPlaylist.id,
          spotify_track_id: fav.spotify_track_id,
          track_name: fav.track_name,
          artist_name: fav.artist_name,
          track_duration_ms: fav.track_duration_ms || 0,
        }]);
      }
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Erro ao adicionar música à playlist');
    } finally {
      setAddingTrackId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 160 }}>
      <div style={{ width: '100%', maxWidth: '600px', maxHeight: '85vh', background: '#0f1b2d', border: '2px solid #ec4899', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', right: '18px', top: '18px', background: 'transparent', border: 'none', color: '#9fb0c3', cursor: 'pointer', fontSize: '24px' }}
        >
          ×
        </button>

        <h2 style={{ marginTop: 0, marginBottom: '6px', color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '22px' }}>
          ❤️ Meus Favoritos
        </h2>
        <p style={{ margin: 0, color: '#9fb0c3', fontSize: '13px', marginBottom: '16px' }}>
          Sua biblioteca pessoal de músicas favoritas. Procure e adicione novas músicas a qualquer momento.
        </p>

        {/* Busca no Spotify dentro dos Favoritos */}
        <div style={{ background: '#111c2b', border: '1px solid #223449', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#63d3ff', marginBottom: '8px' }}>
            🔍 Procurar e favoritar músicas no Spotify:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchSpotify()}
              placeholder="Digite o nome da música ou artista..."
              style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #223449', background: '#0f1b2d', color: 'white', fontSize: '13px' }}
            />
            <button
              type="button"
              onClick={handleSearchSpotify}
              disabled={searchLoading}
              style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#ec4899', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
            >
              {searchLoading ? '...' : 'Buscar'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ display: 'grid', gap: '6px', marginTop: '12px', maxHeight: '180px', overflowY: 'auto' }}>
              {searchResults.map((track) => {
                const faved = isFavorited(track.id);
                return (
                  <div key={track.id} style={{ background: '#0f1b2d', padding: '8px 12px', borderRadius: '8px', border: '1px solid #223449', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</div>
                      <div style={{ fontSize: '12px', color: '#9fb0c3' }}>{track.artist || track.artists?.join(', ')}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite({
                        spotify_track_id: track.id,
                        track_name: track.name,
                        artist_name: track.artist || track.artists?.join(', ') || 'Desconhecido',
                        track_duration_ms: track.duration_ms || 0
                      })}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: faved ? '#831843' : '#3b82f6', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {faved ? '❤️ Favoritado' : '🤍 Favoritar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista de Favoritos Salvos */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ color: '#9fb0c3', textAlign: 'center', padding: '20px' }}>Carregando favoritos...</div>
          ) : favorites.length > 0 ? (
            favorites.map((fav) => (
              <div key={fav.id} style={{ background: '#111c2b', border: '1px solid #223449', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{fav.track_name}</div>
                  <div style={{ color: '#9fb0c3', fontSize: '12px', marginTop: '2px' }}>{fav.artist_name}</div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  {selectedPlaylist && (
                    <button
                      type="button"
                      onClick={() => handleAddFavoriteToPlaylist(fav)}
                      disabled={addingTrackId === fav.spotify_track_id}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer', fontSize: '12px', opacity: addingTrackId === fav.spotify_track_id ? 0.6 : 1 }}
                      title={`Adicionar "${fav.track_name}" à playlist ${selectedPlaylist.name}`}
                    >
                      {addingTrackId === fav.spotify_track_id ? 'Adicionando...' : '+ Add na Playlist'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(fav)}
                    style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #ec4899', background: 'transparent', color: '#ec4899', cursor: 'pointer', fontSize: '13px' }}
                    title="Remover dos favoritos"
                  >
                    ❤️ Remover
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: '#9fb0c3', textAlign: 'center', padding: '24px', background: '#111c2b', borderRadius: '12px', border: '1px dashed #223449' }}>
              Você ainda não tem músicas salvas nos favoritos.
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#63d3ff' }}>Pesquise acima para adicionar sua primeira música!</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #223449', background: '#111c2b', color: 'white', cursor: 'pointer' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
