export interface User {
  id: number;
  email: string;
  name: string;
  role?: string;
}

export interface Playlist {
  id: number;
  spotify_id?: string;
  name: string;
  description?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  member_count?: number;
  song_count?: number;
  role?: string;
  spotify_url?: string;
}

export interface Song {
  id: number;
  playlist_id: number;
  spotify_track_id?: string;
  track_name: string;
  artist_name?: string;
  track_duration_ms?: number;
  added_by?: number;
  added_by_name?: string;
  priority?: number;
  created_at?: string;
}

export interface AnalyticsStats {
  total_songs: number;
  total_members: number;
  total_duration_hours: number;
  total_duration_minutes: number;
  songs_by_user: SongByUser[];
  recent_events: Array<{ event_type: string; created_at: string; name?: string }>;
}

export interface SongByUser {
  name: string;
  count: number;
}
