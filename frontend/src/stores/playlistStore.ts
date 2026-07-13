import { create } from 'zustand';
import type { Playlist, Song } from '../types';
import { io, Socket } from 'socket.io-client';

interface PlaylistState {
  playlists: Playlist[];
  selectedPlaylistId: number | null;
  selectedPlaylist: Playlist | null;
  songs: Song[];
  loading: boolean;
  setPlaylists: (playlists: Playlist[]) => void;
  selectPlaylist: (playlist: Playlist | null) => void;
  setSongs: (songs: Song[]) => void;
  setLoading: (loading: boolean) => void;
}

export const usePlaylistStore = create<PlaylistState>((set) => ({
  playlists: [],
  selectedPlaylistId: null,
  selectedPlaylist: null,
  songs: [],
  loading: false,
  // socket placeholder - will be set on init
  // Note: the socket is kept outside of state to avoid re-renders
  // and is managed via closures in this module.
  socket: null as unknown as Socket | null,
  setPlaylists: (playlists) => set({ playlists }),
  selectPlaylist: (selectedPlaylist) => set({ selectedPlaylist }),
  setSongs: (songs) => set({ songs }),
  setLoading: (loading) => set({ loading }),
}));

// Socket setup (module-level so it persists)
let socket: Socket | null = null;
const getBackendBase = () => {
  const base = (import.meta.env.VITE_API_URL as string) || '/api';
  return base.replace(/\/api\/?$/, '') || window.location.origin;
};

export const initSocket = () => {
  if (socket) return socket;
  const backend = getBackendBase();
  socket = io(backend, {
    autoConnect: true,
    auth: {
      token: localStorage.getItem('cooplist_token') || null,
    },
  });

  socket.on('connect', () => {
    console.log('Frontend socket connected', socket?.id);
  });

  socket.on('song_added', (payload: any) => {
    const { song, added_by_name } = payload;
    const set = (usePlaylistStore as any).getState().setSongs;
    const current = (usePlaylistStore as any).getState().songs || [];
    // Append new song and dedupe by id
    const exists = current.find((s: any) => s.id === song.id);
    const updated = exists ? current.map((s: any) => s.id === song.id ? { ...s, ...song } : s) : [...current, { ...song, added_by_name }];
    set(updated);
  });

  socket.on('song_removed', (payload: any) => {
    const { song_id } = payload;
    const set = (usePlaylistStore as any).getState().setSongs;
    const current = (usePlaylistStore as any).getState().songs || [];
    set(current.filter((s: any) => s.id !== song_id));
  });

  socket.on('song_updated', (payload: any) => {
    const { song_id, priority } = payload;
    const set = (usePlaylistStore as any).getState().setSongs;
    const current = (usePlaylistStore as any).getState().songs || [];
    set(current.map((s: any) => s.id === song_id ? { ...s, priority } : s));
  });

  return socket;
};

export const joinPlaylistRoom = (playlistId: number, userId?: number) => {
  if (!socket) initSocket();
  socket?.emit('join_playlist', String(playlistId), userId || null);
};

export const leavePlaylistRoom = (playlistId: number, userId?: number) => {
  socket?.emit('leave_playlist', String(playlistId), userId || null);
};
