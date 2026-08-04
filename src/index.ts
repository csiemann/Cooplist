import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { initDatabase, getDatabase } from './database';
import { authMiddleware } from './middleware/authMiddleware';
import authRoutes from './routes/auth';
import playlistRoutes from './routes/playlists';
import inviteRoutes from './routes/invites';
import songsRoutes from './routes/songs';
import membersRoutes from './routes/members';
import analyticsRoutes from './routes/analytics';
import searchRoutes from './routes/search';
import favoritesRoutes from './routes/favorites';
import spotifyService from './services/spotifyService';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io
export const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('join_playlist', (playlistId: string | number) => {
    const room = `playlist:${playlistId}`;
    socket.join(room);
    console.log(`[Socket.io] Socket ${socket.id} joined room ${room}`);
  });

  socket.on('leave_playlist', (playlistId: string | number) => {
    const room = `playlist:${playlistId}`;
    socket.leave(room);
    console.log(`[Socket.io] Socket ${socket.id} left room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());
app.use(express.static('public'));

// Inicializar BD
initDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Rotas
app.use('/api/auth', authRoutes);

// IMPORTANTE: Montar analytics ANTES de playlists para evitar conflito de rotas
// /api/playlists/:playlistId/analytics deve ser capturado por analytics router
// Não por playlists router que tem GET /:playlistId
app.use('/api/playlists', analyticsRoutes);
app.use('/api/playlists', inviteRoutes);
app.use('/api/playlists', songsRoutes);
app.use('/api/playlists', membersRoutes);
app.use('/api/playlists', playlistRoutes);

app.use('/api/search', searchRoutes);
app.use('/api/favorites', favoritesRoutes);

// Health check
app.get('/api/health', async (req: Request, res: Response): Promise<void> => {
  const spotifyStatus = await spotifyService.validateCredentials();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    spotify: spotifyStatus
  });
});

app.get('/api/spotify/health', async (req: Request, res: Response): Promise<void> => {
  const spotifyStatus = await spotifyService.validateCredentials();
  res.status(spotifyStatus.valid ? 200 : 400).json(spotifyStatus);
});

// Rota para servir o frontend
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

server.listen(PORT, (): void => {
  console.log('');
  console.log('==============================================');
  console.log('  COOPLIST v2.3.1 - Spotify Playlist Manager');
  console.log('  Server running on port ' + PORT);
  console.log('  Access: http://localhost:' + PORT);
  console.log('==============================================');
  console.log('');
});
