import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: path.join(process.cwd(), 'cooplist.db'),
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON');

  // Enum: ADMIN, MODERATOR, USER
  // Tabela de usuários
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      is_banned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de playlists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL,
      max_songs_per_user INTEGER,
      duration_hours INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela: Associação de usuários às playlists com roles
  // role: 'admin', 'moderator', 'user'
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'user',
      is_banned INTEGER DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(playlist_id, user_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela: Músicas adicionadas às playlists
  // priority: número para ordenação (1 = primeiro)
  // position_in_queue: posição atual na fila
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      spotify_track_id TEXT NOT NULL,
      track_name TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      track_duration_ms INTEGER,
      added_by INTEGER NOT NULL,
      priority INTEGER DEFAULT 0,
      position_in_queue INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela: Músicas favoritas do usuário (do Spotify)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      spotify_track_id TEXT NOT NULL,
      track_name TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      track_duration_ms INTEGER,
      spotify_url TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, spotify_track_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela: Histórico de bans (para desban)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ban_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER,
      user_id INTEGER NOT NULL,
      banned_by INTEGER NOT NULL,
      reason TEXT,
      banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      unbanned_at DATETIME,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela: Histórico de remoção de músicas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS song_removal_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      removed_by INTEGER NOT NULL,
      reason TEXT,
      removed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (removed_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela: Auditoria de ações de moderação
  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Database initialized with all tables');
  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}
