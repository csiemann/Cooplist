import express, { Request, Response } from 'express';
import path from 'path';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import playlistRoutes from './routes/playlists';
import searchRoutes from './routes/search';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Inicializar banco de dados
initDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Frontend - Página de Login
app.get('/', (req: Request, res: Response): void => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cooplist - Music Collaboration</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          max-width: 900px;
          width: 100%;
        }
        @media (max-width: 768px) {
          .container {
            grid-template-columns: 1fr;
          }
        }
        .form-section {
          background: white;
          border-radius: 15px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
          color: #333;
          margin-bottom: 30px;
          text-align: center;
          font-size: 24px;
        }
        h2 {
          color: #667eea;
          margin-bottom: 20px;
          font-size: 20px;
          border-bottom: 2px solid #667eea;
          padding-bottom: 10px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          color: #333;
          font-weight: 500;
        }
        input {
          width: 100%;
          padding: 10px 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 14px;
          transition: border-color 0.3s;
        }
        input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button {
          width: 100%;
          padding: 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 10px;
        }
        button:hover {
          background: #764ba2;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .spotify-btn {
          background: #1DB954;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .spotify-btn:hover {
          background: #1ed760;
        }
        .message {
          margin-top: 15px;
          padding: 10px;
          border-radius: 5px;
          text-align: center;
          font-size: 14px;
          display: none;
        }
        .message.success {
          background: #d4edda;
          color: #155724;
          display: block;
        }
        .message.error {
          background: #f8d7da;
          color: #721c24;
          display: block;
        }
        .divider {
          text-align: center;
          margin: 20px 0;
          color: #999;
        }
        .info-section {
          background: white;
          border-radius: 15px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          color: #333;
        }
        .info-section h2 {
          color: #667eea;
          margin-bottom: 20px;
          border: none;
          padding: 0;
        }
        .feature-list {
          list-style: none;
        }
        .feature-list li {
          padding: 12px 0;
          border-bottom: 1px solid #eee;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .feature-list li:last-child {
          border: none;
        }
        .feature-list li::before {
          content: "✓";
          color: #1DB954;
          font-weight: bold;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="form-section">
          <h1>🎵 Cooplist</h1>
          
          <h2>Registrar</h2>
          <form id="registerForm">
            <div class="form-group">
              <label for="regName">Nome</label>
              <input type="text" id="regName" required>
            </div>
            <div class="form-group">
              <label for="regEmail">Email</label>
              <input type="email" id="regEmail" required>
            </div>
            <div class="form-group">
              <label for="regPassword">Senha</label>
              <input type="password" id="regPassword" required>
            </div>
            <button type="submit">Criar Conta</button>
          </form>
          <div id="registerMessage" class="message"></div>

          <div class="divider">ou</div>

          <h2>Fazer Login</h2>
          <form id="loginForm">
            <div class="form-group">
              <label for="loginEmail">Email</label>
              <input type="email" id="loginEmail" required>
            </div>
            <div class="form-group">
              <label for="loginPassword">Senha</label>
              <input type="password" id="loginPassword" required>
            </div>
            <button type="submit">Fazer Login</button>
          </form>
          <div id="loginMessage" class="message"></div>

          <button class="spotify-btn" onclick="loginWithSpotify()">
            🎵 Login com Spotify
          </button>
        </div>

        <div class="info-section">
          <h2>Bem-vindo ao Cooplist!</h2>
          <p>Plataforma colaborativa para criar e compartilhar playlists Spotify com seus amigos.</p>
          
          <h2 style="margin-top: 30px;">Recursos</h2>
          <ul class="feature-list">
            <li>Crie playlists colaborativas</li>
            <li>Compartilhe com amigos e colegas</li>
            <li>Sincronize com Spotify</li>
            <li>Adicione músicas em tempo real</li>
            <li>Controle de acesso por colaborador</li>
            <li>Interface moderna e intuitiva</li>
          </ul>

          <p style="margin-top: 30px; font-size: 13px; color: #999;">
            Desenvolvido com TypeScript, Express e Spotify API
          </p>
        </div>
      </div>

      <script>
        const API_BASE = 'http://localhost:3000/api';

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const messageDiv = document.getElementById('registerMessage');
          
          try {
            const response = await fetch(\`\${API_BASE}/auth/register\`, {
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
              messageDiv.className = 'message success';
              messageDiv.textContent = '✓ Conta criada! Redirecionando...';
              setTimeout(() => window.location.href = '/dashboard', 2000);
            } else {
              messageDiv.className = 'message error';
              messageDiv.textContent = '✗ ' + (data.error || 'Erro ao registrar');
            }
          } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = '✗ Erro de conexão';
          }
        });

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const messageDiv = document.getElementById('loginMessage');
          
          try {
            const response = await fetch(\`\${API_BASE}/auth/login\`, {
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
              messageDiv.className = 'message success';
              messageDiv.textContent = '✓ Login realizado! Redirecionando...';
              setTimeout(() => window.location.href = '/dashboard', 2000);
            } else {
              messageDiv.className = 'message error';
              messageDiv.textContent = '✗ ' + (data.error || 'Credenciais inválidas');
            }
          } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = '✗ Erro de conexão';
          }
        });

        function loginWithSpotify() {
          window.location.href = \`\${API_BASE}/auth/spotify\`;
        }
      </script>
    </body>
    </html>
  `);
});

// Dashboard (placeholder)
app.get('/dashboard', (req: Request, res: Response): void => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Dashboard - Cooplist</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f5f5f5;
          padding: 20px;
        }
        .navbar {
          background: white;
          padding: 15px 20px;
          border-radius: 5px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .navbar h1 {
          color: #667eea;
        }
        button {
          padding: 10px 20px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        }
        button:hover {
          background: #764ba2;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .loading {
          text-align: center;
          color: #667eea;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="navbar">
        <h1>🎵 Cooplist Dashboard</h1>
        <button onclick="logout()">Sair</button>
      </div>
      <div class="container">
        <div class="loading">Carregando playlists...</div>
      </div>

      <script>
        const API_BASE = 'http://localhost:3000/api';
        const token = localStorage.getItem('token');

        if (!token) {
          window.location.href = '/';
        }

        async function loadPlaylists() {
          try {
            const response = await fetch(\`\${API_BASE}/playlists\`, {
              headers: { 'Authorization': \`Bearer \${token}\` }
            });
            const playlists = await response.json();
            document.querySelector('.container').innerHTML = 
              '<p>' + JSON.stringify(playlists, null, 2) + '</p>';
          } catch (error) {
            document.querySelector('.container').innerHTML = '<p>Erro ao carregar</p>';
          }
        }

        function logout() {
          localStorage.removeItem('token');
          window.location.href = '/';
        }

        loadPlaylists();
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, (): void => {
  console.log(`🎵 Cooplist API running on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log(`  POST http://localhost:${PORT}/api/auth/register`);
  console.log(`  POST http://localhost:${PORT}/api/auth/login`);
  console.log(`  GET  http://localhost:${PORT}/api/auth/spotify`);
  console.log(`  GET  http://localhost:${PORT}/api/playlists`);
  console.log(`  GET  http://localhost:${PORT}/api/health`);
});
