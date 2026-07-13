import axios from 'axios';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string }>;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  external_urls: { spotify: string };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private baseURL = 'https://api.spotify.com/v1';
  private authURL = 'https://accounts.spotify.com/api/token';

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';
  }

  // Obter token de acesso do Spotify
  async getAccessToken(code: string): Promise<string> {
    try {
      const response = await axios.post<SpotifyTokenResponse>(this.authURL, null, {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri
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

  // Obter informações do usuário Spotify
  async getUserProfile(accessToken: string): Promise<SpotifyUser> {
    try {
      const response = await axios.get<SpotifyUser>(`${this.baseURL}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error('Failed to get Spotify user profile');
    }
  }

  // Buscar músicas no Spotify
  async searchTracks(query: string, accessToken: string, limit: number = 10): Promise<SpotifyTrack[]> {
    try {
      const response = await axios.get<SpotifySearchResponse>(`${this.baseURL}/search`, {
        params: {
          q: query,
          type: 'track',
          limit
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return response.data.tracks.items;
    } catch (error) {
      throw new Error('Failed to search Spotify tracks');
    }
  }

  // Criar playlist no Spotify
  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    accessToken: string
  ): Promise<{ id: string; external_urls: { spotify: string } }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/users/${userId}/playlists`,
        {
          name,
          description,
          public: true
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw new Error('Failed to create Spotify playlist');
    }
  }

  // Adicionar música à playlist Spotify
  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    accessToken: string
  ): Promise<void> {
    try {
      await axios.post(
        `${this.baseURL}/playlists/${playlistId}/tracks`,
        {
          uris: trackUris
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      throw new Error('Failed to add tracks to Spotify playlist');
    }
  }

  getAuthorizationUrl(): string {
    const scopes = [
      'user-read-private',
      'user-read-email',
      'playlist-modify-public',
      'playlist-modify-private'
    ].join('%20');

    return (
      `https://accounts.spotify.com/authorize?` +
      `client_id=${this.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
      `scope=${scopes}`
    );
  }
}

export default new SpotifyService();
