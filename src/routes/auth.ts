import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database';
import { generateToken } from '../services/authService';
import spotifyService from '../services/spotifyService';

const router = Router();

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Registrar novo usuário
router.post('/register', async (req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const db = getDatabase();
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);

    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.run(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name]
    );

    const token = generateToken(result.lastID, email);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.lastID, email, name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login com email e senha
router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Missing email or password' });
      return;
    }

    const db = getDatabase();
    const user = await db.get('SELECT id, email, password, name FROM users WHERE email = ?', email);

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.email);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Redirecionar para autenticação Spotify
router.get('/spotify', (req: Request, res: Response): void => {
  const authUrl = spotifyService.getAuthorizationUrl();
  res.redirect(authUrl);
});

// Callback da autenticação Spotify
router.get('/spotify/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, error } = req.query;

    if (error) {
      res.status(400).json({ error: 'Spotify auth failed' });
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'No authorization code' });
      return;
    }

    const accessToken = await spotifyService.getAccessToken(code);
    const spotifyUser = await spotifyService.getUserProfile(accessToken);

    const db = getDatabase();
    let user = await db.get('SELECT id, email, name FROM users WHERE spotify_id = ?', spotifyUser.id);

    if (!user) {
      const avatarUrl = spotifyUser.images?.[0]?.url || null;
      const result = await db.run(
        'INSERT INTO users (email, spotify_id, name, avatar_url, password) VALUES (?, ?, ?, ?, ?)',
        [spotifyUser.email, spotifyUser.id, spotifyUser.display_name, avatarUrl, '']
      );

      user = {
        id: result.lastID,
        email: spotifyUser.email,
        name: spotifyUser.display_name
      };
    }

    const token = generateToken(user.id, user.email);

    // Redirecionar para frontend com token
    res.redirect(`http://localhost:5173/login-success?token=${token}`);
  } catch (error) {
    res.status(500).json({ error: 'Spotify login failed' });
  }
});

export default router;
