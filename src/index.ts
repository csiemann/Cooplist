import express, { Request, Response } from 'express';
import path from 'path';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import playlistRoutes from './routes/playlists';
import songsRoutes from './routes/songs';
import membersRoutes from './routes/members';
import searchRoutes from './routes/search';
import favoritesRoutes from './routes/favorites';

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
app.use('/api/playlists', songsRoutes);
app.use('/api/playlists', membersRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/favorites', favoritesRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Frontend - Pagina de Login
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
          max-width: 1000px;
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
          font-size: 28px;
        }
        h2 {
          color: #667eea;
          margin-bottom: 20px;
          font-size: 18px;
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
          font-size: 14px;
        }
        input {
          width: 100%;
          padding: 12px;
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
          font-weight: 600;
        }
        button:hover {
          background: #764ba2;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.2);
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
          font-size: 14px;
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
          <h1>Music Cooplist</h1>
          
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

          <div class="divider">--- ou ---</div>

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
            <button type="submit">Entrar</button>
          </form>
          <div id="loginMessage" class="message"></div>
        </div>

        <div class="info-section">
          <h2>Bem-vindo ao Cooplist!</h2>
          <p>Plataforma colaborativa para criar playlists musicais em grupo.</p>
          
          <h2 class="section-title">Recursos Principais</h2>
          <ul class="feature-list">
            <li>Criar e gerenciar playlists colaborativas</li>
            <li>Controle de acesso (Admin, Moderador, Utilizador)</li>
            <li>Buscar musicas diretamente do Spotify</li>
            <li>Lista de favoritos pessoal</li>
            <li>Sistema de prioridade na fila</li>
            <li>Sorteio automatico (1 musica/utilizador)</li>
            <li>Limite de musicas por utilizador</li>
            <li>Gerenciamento de utilizadores e bans</li>
          </ul>

          <h2 class="section-title">Cargos e Permissoes</h2>
          <ul class="feature-list">
            <li>Admin: Gerencia tudo na playlist</li>
            <li>Moderador: Gerencia conteudo e utilizadores limitados</li>
            <li>Utilizador Comum: Adiciona musicas</li>
          </ul>

          <p style="margin-top: 25px; font-size: 12px; color: #999;">
            2024 Cooplist - Desenvolvido com TypeScript e Spotify API
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
              messageDiv.textContent = 'Erro: ' + (data.error || 'Erro ao registrar');
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

app.listen(PORT, (): void => {
  console.log('COOPLIST API v2.0 - Iniciado');
  console.log('Servidor rodando na porta ' + PORT);
  console.log('Acesse: http://localhost:' + PORT);
});
