import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';

let db: Database | null = null;

export async function closeDatabase(): Promise<void> {
  if (db) {
    try {
      await db.close();
    } catch {}
    db = null;
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const dbPath = process.env.DATABASE_URL || (process.env.NODE_ENV === 'test' ? ':memory:' : path.join(process.cwd(), 'cooplist.db'));

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON');

  // Usuarios
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      is_banned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure legacy databases have the 'role' and 'is_banned' columns
  await db.exec(`
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'
  `).catch(() => { });

  await db.exec(`
    ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0
  `).catch(() => { });

  // Seed test users if they do not already exist
  const adminEmail = 'admin@admin.com';
  const moderatorEmail = 'moderador@moderador.com';

  const passwordHashAdmin = await bcrypt.hash('admin1', 10);
  await db.run(
    'INSERT OR IGNORE INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
    [adminEmail, passwordHashAdmin, 'Admin', 'admin']
  );

  const passwordHashMod = await bcrypt.hash('moderador', 10);
  await db.run(
    'INSERT OR IGNORE INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
    [moderatorEmail, passwordHashMod, 'Moderador', 'moderator']
  );

  // Playlists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spotify_id TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL,
      max_songs_per_user INTEGER,
      duration_hours INTEGER,
      is_public INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Membros da Playlist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(playlist_id, user_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Convites de entrada
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      email TEXT,
      token TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'member',
      created_by INTEGER NOT NULL,
      expires_at DATETIME,
      used_at DATETIME,
      max_uses INTEGER,
      uses INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    ALTER TABLE invites ADD COLUMN max_uses INTEGER
  `).catch(() => { });

  await db.exec(`
    ALTER TABLE invites ADD COLUMN uses INTEGER DEFAULT 0
  `).catch(() => { });

  // Musicas na Playlist
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Favoritos
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      spotify_track_id TEXT NOT NULL,
      track_name TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      track_duration_ms INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, spotify_track_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Historico de eventos para analytics
  await db.exec(`
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      event_type TEXT,
      user_id INTEGER,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Banimentos de membros em playlists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      banned_by INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(playlist_id, user_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Column fallback for playlist_songs is_banned
  await db.exec(`
    ALTER TABLE playlist_songs ADD COLUMN is_banned INTEGER DEFAULT 0
  `).catch(() => { });

  console.log('✅ Database initialized');
  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}
