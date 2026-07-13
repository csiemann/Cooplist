import { create } from 'zustand';
import type { Playlist, Song } from '../types';

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
  setPlaylists: (playlists) => set({ playlists }),
  selectPlaylist: (selectedPlaylist) => set({ selectedPlaylist }),
  setSongs: (songs) => set({ songs }),
  setLoading: (loading) => set({ loading }),
}));
