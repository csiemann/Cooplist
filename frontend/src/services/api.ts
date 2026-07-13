import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cooplist_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

export const register = (email: string, password: string, name: string) =>
  api.post('/auth/register', { email, password, name });

export const getPlaylists = () => api.get('/playlists');

export const createPlaylist = (payload: { name: string; description?: string }) =>
  api.post('/playlists', payload);

export const acceptInvite = (token: string) =>
  api.post(`/playlists/accept/${token}`);

export const deletePlaylist = (playlistId: number) => api.delete(`/playlists/${playlistId}`);

export const getPlaylistDetails = (playlistId: number) => api.get(`/playlists/${playlistId}`);

export const getAnalytics = (playlistId: number) => api.get(`/playlists/${playlistId}/analytics`);

export const searchSpotify = (q: string, limit = 20) => api.get('/search', { params: { q, limit } });

export const addSongToPlaylist = (playlistId: number, payload: Record<string, unknown>) =>
  api.post(`/playlists/${playlistId}/songs`, payload);

export const removeSongFromPlaylist = (playlistId: number, songId: number) =>
  api.delete(`/playlists/${playlistId}/songs/${songId}`);

export const getMembers = (playlistId: number) => api.get(`/playlists/${playlistId}/members`);

export const inviteMember = (playlistId: number, payload: { email: string; role?: string }) =>
  api.post(`/playlists/${playlistId}/invite-email`, payload);

export const createInviteLink = (playlistId: number, payload: { role?: string }) =>
  api.post(`/playlists/${playlistId}/invite-link`, payload);

export const updateMemberRole = (playlistId: number, memberId: number, role: string) =>
  api.patch(`/playlists/${playlistId}/members/${memberId}`, { role });

export const removeMember = (playlistId: number, memberId: number) =>
  api.delete(`/playlists/${playlistId}/members/${memberId}`);

export default api;
