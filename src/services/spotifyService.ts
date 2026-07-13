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
  album?: {
    images: Array<{ url: string }>;
  };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private baseURL = 'https://api.spotify.com/v1';
  private authURL = 'https://accounts.spotify.com/api/token';

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  }

  // Obter token de acesso do Spotify (Client Credentials flow)
  async getClientToken(): Promise<string> {
    try {
      const response = await axios.post<SpotifyTokenResponse>(this.authURL, null, {
        params: {
          grant_type: 'client_credentials'
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        }
      });

      return response.data.access_token;
    } catch (error) {
      throw new Error('Failed to get Spotify access token');
    }
  }

  // Buscar músicas no Spotify
  async searchTracks(query: string, limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      const token = await this.getClientToken();

      const response = await axios.get<SpotifySearchResponse>(`${this.baseURL}/search`, {
        params: {
          q: query,
          type: 'track',
          limit
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists,
        duration_ms: track.duration_ms,
        external_urls: track.external_urls,
        album: track.album
      }));
    } catch (error) {
      console.error('Spotify search error:', error);
      throw new Error('Failed to search Spotify tracks');
    }
  }

  // Obter detalhes de uma faixa
  async getTrack(trackId: string): Promise<SpotifyTrack> {
    try {
      const token = await this.getClientToken();

      const response = await axios.get<SpotifyTrack>(`${this.baseURL}/tracks/${trackId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error('Failed to get track details');
    }
  }
}

export default new SpotifyService();
