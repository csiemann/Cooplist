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

  // Obter token com Client Credentials (usa apenas credenciais do app)
  private async getAccessToken(): Promise<string> {
    // Se token ainda é valido, retorna o existente
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<SpotifyTokenResponse>(this.authURL, null, {
        params: { grant_type: 'client_credentials' },
        auth: { username: this.clientId, password: this.clientSecret }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      return this.accessToken;
    } catch (error) {
      throw new Error('Failed to get Spotify access token');
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
      throw new Error('Failed to search tracks');
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
