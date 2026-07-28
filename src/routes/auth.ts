import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database';
import { generateToken } from '../services/authService';

const router = Router();

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

// Registrar novo usuário
router.post('/register', async (req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Missing required fields: email, password, name' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
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

    const userId = result.lastID || 0;
    const token = generateToken(userId, email);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: userId, email, name, role: 'member' }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    console.log('Login request for email:', email);

    if (!email || !password) {
      res.status(400).json({ error: 'Missing email or password' });
      return;
    }

    const db = getDatabase();
    const user = await db.get(
      'SELECT id, email, password, name, role, is_banned FROM users WHERE email = ?',
      email
    );

    console.log('Login user found:', !!user, user ? user.email : null);

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (user.is_banned) {
      res.status(403).json({ error: 'This account has been banned' });
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
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
