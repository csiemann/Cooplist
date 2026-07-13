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

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io
export const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
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
app.use('/api/playlists', playlistRoutes);
app.use('/api/playlists', inviteRoutes);
app.use('/api/playlists', songsRoutes);
app.use('/api/playlists', membersRoutes);
app.use('/api/playlists', analyticsRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join playlist room
  socket.on('join_playlist', (playlistId: string, userId: number) => {
    socket.join(`playlist:${playlistId}`);
    socket.broadcast.to(`playlist:${playlistId}`).emit('user_joined', {
      userId,
      timestamp: new Date().toISOString()
    });
  });

  // Leave playlist room
  socket.on('leave_playlist', (playlistId: string, userId: number) => {
    socket.leave(`playlist:${playlistId}`);
    socket.broadcast.to(`playlist:${playlistId}`).emit('user_left', { userId });
  });

  // Notificacoes em tempo real
  socket.on('queue_update', (playlistId: string, data: any) => {
    io.to(`playlist:${playlistId}`).emit('queue_updated', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Frontend - Login page
app.get('/', (req: Request, res: Response): void => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cooplist - Spotify Playlist Manager</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #1DB954 0%, #191414 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          max-width: 1000px;
          width: 100%;
        }
        @media (max-width: 768px) {
          .container {
            grid-template-columns: 1fr;
          }
        }
        .form-section {
          background: #282828;
          border-radius: 15px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        }
        h1 {
          color: #1DB954;
          margin-bottom: 30px;
          text-align: center;
          font-size: 28px;
        }
        h2 {
          color: #1DB954;
          margin-bottom: 20px;
          font-size: 18px;
          border-bottom: 2px solid #1DB954;
          padding-bottom: 10px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          color: #fff;
          font-weight: 500;
          font-size: 14px;
        }
        input {
          width: 100%;
          padding: 12px;
          border: 1px solid #404040;
          border-radius: 5px;
          background: #404040;
          color: #fff;
          font-size: 14px;
        }
        input::placeholder {
          color: #b3b3b3;
        }
        input:focus {
          outline: none;
          border-color: #1DB954;
          background: #464646;
        }
        button {
          width: 100%;
          padding: 12px;
          background: #1DB954;
          color: #000;
          border: none;
          border-radius: 25px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 10px;
        }
        button:hover {
          background: #1ed760;
          transform: scale(1.02);
        }
        .message {
          margin-top: 15px;
          padding: 12px;
          border-radius: 5px;
          text-align: center;
          font-size: 14px;
          display: none;
        }
        .message.success {
          background: rgba(29, 185, 84, 0.2);
          color: #1DB954;
          display: block;
        }
        .message.error {
          background: rgba(255, 0, 0, 0.2);
          color: #ff4444;
          display: block;
        }
        .divider {
          text-align: center;
          margin: 20px 0;
          color: #b3b3b3;
          font-size: 14px;
        }
        .info-section {
          background: #282828;
          border-radius: 15px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          color: #fff;
        }
        .info-section h2 {
          color: #1DB954;
          margin-bottom: 20px;
          border: none;
          padding: 0;
        }
        .feature-list {
          list-style: none;
        }
        .feature-list li {
          padding: 12px 0;
          border-bottom: 1px solid #404040;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }
        .feature-list li:last-child {
          border: none;
        }
        .feature-list li::before {
          content: "*";
          color: #1DB954;
          font-weight: bold;
          font-size: 18px;
          flex-shrink: 0;
        }
        .section-title {
          margin-top: 25px;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="form-section">
          <h1>Cooplist</h1>
          
          <h2>Registrar</h2>
          <form id="registerForm">
            <div class="form-group">
              <label for="regName">Nome</label>
              <input type="text" id="regName" placeholder="Seu nome completo" required>
            </div>
            <div class="form-group">
              <label for="regEmail">Email</label>
              <input type="email" id="regEmail" placeholder="seu@email.com" required>
            </div>
            <div class="form-group">
              <label for="regPassword">Senha</label>
              <input type="password" id="regPassword" placeholder="Minimo 6 caracteres" required>
            </div>
            <button type="submit">Criar Conta</button>
          </form>
          <div id="registerMessage" class="message"></div>

          <div class="divider">--- ou ---</div>

          <h2>Login</h2>
          <form id="loginForm">
            <div class="form-group">
              <label for="loginEmail">Email</label>
              <input type="email" id="loginEmail" placeholder="seu@email.com" required>
            </div>
            <div class="form-group">
              <label for="loginPassword">Senha</label>
              <input type="password" id="loginPassword" placeholder="Sua senha" required>
            </div>
            <button type="submit">Entrar</button>
          </form>
          <div id="loginMessage" class="message"></div>
        </div>

        <div class="info-section">
          <h2>Bem-vindo ao Cooplist</h2>
          <p>Crie e gerencie playlists colaborativas no Spotify com sua equipe.</p>
          
          <h2 class="section-title">Recursos</h2>
          <ul class="feature-list">
            <li>Criar playlists no Spotify</li>
            <li>Adicionar musicas da API Spotify</li>
            <li>Convites por email e link</li>
            <li>Controle de acesso (Admin, Moderador, Utilizador)</li>
            <li>Fila de reproducao inteligente</li>
            <li>Analytics em tempo real</li>
            <li>Sincronizacao automatica com Spotify</li>
            <li>Favoritos pessoais</li>
          </ul>

          <p style="margin-top: 25px; font-size: 12px; color: #b3b3b3;">
            Desenvolvido com TypeScript, Express, React e Spotify API
          </p>
        </div>
      </div>

      <script>
        const API_BASE = 'http://localhost:3000/api';

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const messageDiv = document.getElementById('registerMessage');
          
          try {
            const response = await fetch(API_BASE + '/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPassword').value,
                name: document.getElementById('regName').value
              })
            });

            const data = await response.json();

            if (response.ok) {
              localStorage.setItem('token', data.token);
              localStorage.setItem('user', JSON.stringify(data.user));
              messageDiv.className = 'message success';
              messageDiv.textContent = 'Conta criada! Redirecionando...';
              setTimeout(() => window.location.href = '/dashboard', 1500);
            } else {
              messageDiv.className = 'message error';
              messageDiv.textContent = 'Erro: ' + (data.error || 'Falha ao registrar');
            }
          } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = 'Erro de conexao';
          }
        });

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const messageDiv = document.getElementById('loginMessage');
          
          try {
            const response = await fetch(API_BASE + '/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
              })
            });

            const data = await response.json();

            if (response.ok) {
              localStorage.setItem('token', data.token);
              localStorage.setItem('user', JSON.stringify(data.user));
              messageDiv.className = 'message success';
              messageDiv.textContent = 'Login realizado! Redirecionando...';
              setTimeout(() => window.location.href = '/dashboard', 1500);
            } else {
              messageDiv.className = 'message error';
              messageDiv.textContent = 'Erro: ' + (data.error || 'Credenciais invalidas');
            }
          } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = 'Erro de conexao';
          }
        });
      </script>
    </body>
    </html>
  `);
});

server.listen(PORT, (): void => {
  console.log('');
  console.log('==============================================');
  console.log('  COOPLIST v2.1 - Spotify Playlist Manager');
  console.log('  Server running on port ' + PORT);
  console.log('  Access: http://localhost:' + PORT);
  console.log('==============================================');
  console.log('');
  console.log('Features:');
  console.log('  - Create/manage Spotify playlists');
  console.log('  - Invite members (email & links)');
  console.log('  - Real-time updates (WebSocket)');
  console.log('  - Analytics dashboard');
  console.log('  - Smart queue system');
  console.log('');
});
