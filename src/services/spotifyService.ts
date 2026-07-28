import axios from 'axios';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  duration_ms: number;
  external_urls: { spotify: string };
  album?: { images: Array<{ url: string }> };
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  external_urls: { spotify: string };
  images: Array<{ url: string }>;
}

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private baseURL = 'https://api.spotify.com/v1';
  private authURL = 'https://accounts.spotify.com/api/token';
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  }

  private getClientId(): string {
    return (process.env.SPOTIFY_CLIENT_ID || this.clientId || '').trim();
  }

  private getClientSecret(): string {
    return (process.env.SPOTIFY_CLIENT_SECRET || this.clientSecret || '').trim();
  }

  // Obter token com Client Credentials (usa apenas credenciais do app)
  private async getAccessToken(): Promise<string> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    if (!clientId || !clientSecret) {
      throw new Error('Spotify Client ID or Client Secret missing');
    }

    // Se token ainda é valido, retorna o existente
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const authBuffer = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post<SpotifyTokenResponse>(
        this.authURL,
        new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authBuffer}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      return this.accessToken;
    } catch (error: any) {
      console.error('Spotify token request error:', error.response?.data || error.message);
      throw new Error(`Failed to get Spotify access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  // Validar credenciais do Spotify e retornar status
  async validateCredentials(): Promise<{ valid: boolean; message: string; clientIdPreview?: string }> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    if (!clientId || !clientSecret) {
      return { valid: false, message: 'SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is empty' };
    }

    try {
      const authBuffer = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post<SpotifyTokenResponse>(
        this.authURL,
        new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authBuffer}`
          }
        }
      );

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + response.data.expires_in * 1000;
        const preview = clientId.length > 8 ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : clientId;
        return { valid: true, message: 'Spotify credentials valid', clientIdPreview: preview };
      }

      return { valid: false, message: 'Unexpected response from Spotify API' };
    } catch (error: any) {
      const errorDetail = error.response?.data?.error_description || error.response?.data?.error || error.message;
      return { valid: false, message: `Spotify authentication failed: ${errorDetail}` };
    }
  }

  // Buscar faixas
  async searchTracks(query: string, limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(`${this.baseURL}/search`, {
        params: { q: query, type: 'track', limit },
        headers: { Authorization: `Bearer ${token}` }
      });

      return response.data.tracks.items.map((track: SpotifyTrack) => ({
        id: track.id,
        name: track.name,
        artists: track.artists,
        duration_ms: track.duration_ms,
        external_urls: track.external_urls,
        album: track.album
      }));
    } catch (error) {
      console.warn('Spotify search failed (credentials or API offline). Returning fallback tracks for query:', query);
      // Fallback tracks para demonstração se as credenciais do Spotify não forem válidas
      const mockTrackIds = ['4cOdK2wGLETKBW3PvgPWqT', '0Vjeewi40mUZw02d1dZ8zW', '7qiZ2u9vB1p3qK2l00wT4z'];
      return [
        {
          id: mockTrackIds[0],
          name: `${query} - Live Acoustic Session`,
          artists: [{ name: 'Cooplist Artists' }],
          duration_ms: 215000,
          external_urls: { spotify: `https://open.spotify.com/track/${mockTrackIds[0]}` },
          album: { images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300' }] }
        },
        {
          id: mockTrackIds[1],
          name: `${query} - Original Mix`,
          artists: [{ name: 'Cooplist Band' }],
          duration_ms: 198000,
          external_urls: { spotify: `https://open.spotify.com/track/${mockTrackIds[1]}` },
          album: { images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300' }] }
        },
        {
          id: mockTrackIds[2],
          name: `Remix: ${query}`,
          artists: [{ name: 'DJ Cooplist' }],
          duration_ms: 242000,
          external_urls: { spotify: `https://open.spotify.com/track/${mockTrackIds[2]}` },
          album: { images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300' }] }
        }
      ].slice(0, limit);
    }
  }

  // Criar playlist no Spotify (com user access token)
  async createPlaylistWithUserToken(
    userAccessToken: string,
    name: string,
    description: string,
    isPublic: boolean = false
  ): Promise<SpotifyPlaylist> {
    try {
      // 1. Obter userId do usuário logado
      const meResponse = await axios.get(`${this.baseURL}/me`, {
        headers: { Authorization: `Bearer ${userAccessToken}` }
      });

      const userId = meResponse.data.id;

      // 2. Criar playlist privada na conta do usuário
      const playlistResponse = await axios.post(
        `${this.baseURL}/users/${userId}/playlists`,
        {
          name,
          description,
          public: isPublic // Privado por padrão (recomendado)
        },
        {
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: playlistResponse.data.id,
        name: playlistResponse.data.name,
        description: playlistResponse.data.description,
        external_urls: playlistResponse.data.external_urls,
        images: playlistResponse.data.images || []
      };
    } catch (error) {
      console.error('Failed to create playlist on Spotify:', error);
      throw new Error('Failed to create playlist on Spotify');
    }
  }

  // Criar playlist local (fallback se não tiver user token)
  async createPlaylist(name: string, description: string): Promise<SpotifyPlaylist> {
    if (!this.clientId || !this.clientSecret) {
      console.warn('Spotify credentials not configured. Creating local playlist fallback.');
      return {
        id: `local-${Date.now()}`,
        name,
        description,
        external_urls: { spotify: '' },
        images: []
      };
    }

    try {
      const token = await this.getAccessToken();

      // O endpoint /me não funciona com client credentials; geramos playlist local como fallback
      console.warn('Spotify API playlist creation is not supported with client credentials. Using fallback playlist creation.');
      return {
        id: `spotify-fallback-${Date.now()}`,
        name,
        description,
        external_urls: { spotify: '' },
        images: []
      };
    } catch (error) {
      console.error('Spotify error:', error);
      throw new Error('Failed to create playlist');
    }
  }

  // Adicionar musicas a playlist
  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    userAccessToken?: string
  ): Promise<void> {
    try {
      const token = userAccessToken || await this.getAccessToken();

      // Dividir em chunks de 100 (limite do Spotify)
      for (let i = 0; i < trackUris.length; i += 100) {
        const chunk = trackUris.slice(i, i + 100);
        await axios.post(
          `${this.baseURL}/playlists/${playlistId}/tracks`,
          { uris: chunk.map(id => `spotify:track:${id}`) },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }
    } catch (error) {
      throw new Error('Failed to add tracks');
    }
  }

  // Remover musicas da playlist
  async removeTracksFromPlaylist(
    playlistId: string,
    trackUris: string[],
    userAccessToken?: string
  ): Promise<void> {
    try {
      const token = userAccessToken || await this.getAccessToken();

      for (let i = 0; i < trackUris.length; i += 100) {
        const chunk = trackUris.slice(i, i + 100);
        await axios.delete(
          `${this.baseURL}/playlists/${playlistId}/tracks`,
          {
            headers: { Authorization: `Bearer ${token}` },
            data: { tracks: chunk.map(id => ({ uri: `spotify:track:${id}` })) }
          }
        );
      }
    } catch (error) {
      throw new Error('Failed to remove tracks');
    }
  }

  // Deletar playlist
  async deletePlaylist(playlistId: string): Promise<void> {
    try {
      const token = await this.getAccessToken();

      // Spotify nao permite deletar playlists via API, apenas remover publico
      // Vamos deixar a playlist privada como "deletada"
      await axios.put(
        `${this.baseURL}/playlists/${playlistId}`,
        {
          public: false,
          name: '[DELETADO] ' + Date.now(),
          description: 'Esta playlist foi deletada'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      throw new Error('Failed to delete playlist');
    }
  }
}

export default new SpotifyService();
