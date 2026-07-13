# COOPLIST v2.0 - Implementação Completa

## Resumo das Alterações e Melhorias

O projeto foi completamente reestruturado para atender suas especificações. Aqui estão todos os recursos implementados:

---

## ✅ Funcionalidades Implementadas

### 1. **Sistema de Autenticação**
- ✅ Registro de usuários (nome, email, senha)
- ✅ Login com JWT
- ✅ Proteção de rotas com middleware de autenticação
- ✅ Hash de senha com bcrypt

**Endpoints:**
```
POST /api/auth/register
POST /api/auth/login
```

---

### 2. **Sistema de Cargos e Permissões**

**Três níveis de acesso por playlist:**

| Cargo | Permissões |
|-------|-----------|
| **Admin** | ✅ Ver todos os dados<br/>✅ Gerenciar membros (adicionar, remover, banir, desbanir)<br/>✅ Alterar cargos<br/>✅ Remover músicas<br/>✅ Reordenar fila<br/>✅ Editar configurações da playlist |
| **Moderador** | ✅ Adicionar membros<br/>✅ Remover/banir usuários<br/>✅ Remover músicas<br/>✅ Reordenar fila<br/>✅ Desbanir usuários |
| **Usuário Comum** | ✅ Adicionar músicas<br/>✅ Definir prioridade da música<br/>✅ Ver lista de membros |

---

### 3. **Gerenciamento de Playlists**

**Criar Playlist (Admin/Moderador):**
- Nome da playlist
- Descrição
- Limite de músicas por usuário (opcional)
- Duração máxima em horas (opcional)

**Endpoints:**
```
GET  /api/playlists                  - Listar playlists do usuário
POST /api/playlists                  - Criar nova playlist
GET  /api/playlists/:playlistId      - Detalhes da playlist
PUT  /api/playlists/:playlistId      - Editar configurações (admin)
DELETE /api/playlists/:playlistId    - Deletar (admin)
```

**Banco de Dados:**
```
CREATE TABLE playlists (
  id INTEGER PRIMARY KEY,
  name TEXT,
  description TEXT,
  created_by INTEGER,
  max_songs_per_user INTEGER,
  duration_hours INTEGER,
  is_active INTEGER,
  created_at DATETIME
)
```

---

### 4. **Sistema de Fila de Reprodução com Sorteio**

**Algoritmo Implementado:**
1. Agrupa todas as músicas por usuário
2. Sorteia uma música de cada usuário por vez
3. Se houver mais músicas que usuários, continua o ciclo
4. Resultado: sempre uma música de cada usuário até o final da lista

**Endpoint:**
```
POST /api/playlists/:playlistId/shuffle-queue
```

**Resultado na fila:**
```
Fila reordenada:
- Música do Usuário A (prioridade 1)
- Música do Usuário B (prioridade 1)
- Música do Usuário C (prioridade 1)
- Música do Usuário A (prioridade 2)
- Música do Usuário B (prioridade 2)
...
```

---

### 5. **Adição de Músicas com Prioridade**

**Sistema de Prioridade:**
- Cada usuário pode definir a prioridade ao adicionar uma música
- Prioridade maior = toca antes
- Músicas do mesmo usuário são ordenadas por prioridade e data

**Endpoints:**
```
POST /api/playlists/:playlistId/songs
  {
    "spotify_track_id": "3n3Ppam7vgaVa1iaRUc9Lp",
    "track_name": "Nome da Musica",
    "artist_name": "Artista",
    "track_duration_ms": 180000,
    "priority": 1
  }

PATCH /api/playlists/:playlistId/songs/:songId
  { "priority": 2 }
```

---

### 6. **Integração com Spotify API**

**Busca de Músicas:**
```
GET /api/search?q=Beatles&limit=20
```

**Resposta:**
```json
{
  "results": [
    {
      "id": "3n3Ppam7vgaVa1iaRUc9Lp",
      "name": "Hey Jude",
      "artist": "The Beatles",
      "duration_ms": 427333,
      "external_url": "https://open.spotify.com/track/...",
      "image": "https://i.scdn.co/image/..."
    }
  ]
}
```

---

### 7. **Sistema de Favoritos**

Usuários podem adicionar músicas à sua lista de favoritos do Spotify e depois adicioná-las às playlists.

**Endpoints:**
```
GET /api/favorites                    - Listar favoritos
POST /api/favorites                   - Adicionar aos favoritos
DELETE /api/favorites/:favoriteId     - Remover dos favoritos
```

**Banco de Dados:**
```
CREATE TABLE user_favorites (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  spotify_track_id TEXT,
  track_name TEXT,
  artist_name TEXT,
  track_duration_ms INTEGER,
  spotify_url TEXT,
  added_at DATETIME,
  UNIQUE(user_id, spotify_track_id)
)
```

---

### 8. **Gerenciamento de Membros**

**Adicionar Membro:**
- Admin/Moderador convida usuário por email
- Novo membro é adicionado com cargo padrão "user"

**Endpoints:**
```
GET /api/playlists/:playlistId/members
POST /api/playlists/:playlistId/members
  { "email": "usuario@email.com", "role": "user" }
PATCH /api/playlists/:playlistId/members/:memberId
  { "role": "moderator" }
DELETE /api/playlists/:playlistId/members/:memberId
```

---

### 9. **Sistema de Bans**

**Banir Usuário da Playlist:**
- Admin/Moderador podem banir usuários
- Histórico de bans é registrado
- Usuários banidos não podem mais acessar a playlist

**Endpoints:**
```
POST /api/playlists/:playlistId/members/:memberId/ban
  { "reason": "Comportamento inadequado" }

POST /api/playlists/:playlistId/members/:memberId/unban
```

**Banco de Dados:**
```
CREATE TABLE ban_history (
  id INTEGER PRIMARY KEY,
  playlist_id INTEGER,
  user_id INTEGER,
  banned_by INTEGER,
  reason TEXT,
  banned_at DATETIME,
  unbanned_at DATETIME
)
```

---

### 10. **Remoção de Músicas**

**Admin/Moderador podem:**
- Remover músicas da playlist
- Registrar motivo da remoção
- Manter histórico de remoções

**Endpoints:**
```
DELETE /api/playlists/:playlistId/songs/:songId
  { "reason": "Conteudo nao apropriado" }
```

---

## 📊 Estrutura do Banco de Dados

```sql
-- Usuarios (5 campos)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  name TEXT,
  is_banned INTEGER
);

-- Playlists (7 campos)
CREATE TABLE playlists (
  id INTEGER PRIMARY KEY,
  name TEXT,
  description TEXT,
  created_by INTEGER,
  max_songs_per_user INTEGER,
  duration_hours INTEGER,
  is_active INTEGER
);

-- Associacao Usuario-Playlist com Role
CREATE TABLE playlist_members (
  id INTEGER PRIMARY KEY,
  playlist_id INTEGER,
  user_id INTEGER,
  role TEXT ('admin', 'moderator', 'user'),
  is_banned INTEGER,
  joined_at DATETIME,
  UNIQUE(playlist_id, user_id)
);

-- Musicas na Playlist
CREATE TABLE playlist_songs (
  id INTEGER PRIMARY KEY,
  playlist_id INTEGER,
  spotify_track_id TEXT,
  track_name TEXT,
  artist_name TEXT,
  track_duration_ms INTEGER,
  added_by INTEGER,
  priority INTEGER,
  position_in_queue INTEGER,
  is_banned INTEGER,
  added_at DATETIME
);

-- Favoritos do Usuario
CREATE TABLE user_favorites (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  spotify_track_id TEXT,
  track_name TEXT,
  artist_name TEXT,
  track_duration_ms INTEGER,
  spotify_url TEXT,
  added_at DATETIME,
  UNIQUE(user_id, spotify_track_id)
);

-- Historico de Bans
CREATE TABLE ban_history (
  id INTEGER PRIMARY KEY,
  playlist_id INTEGER,
  user_id INTEGER,
  banned_by INTEGER,
  reason TEXT,
  banned_at DATETIME,
  unbanned_at DATETIME
);

-- Historico de Remocao de Musicas
CREATE TABLE song_removal_history (
  id INTEGER PRIMARY KEY,
  playlist_id INTEGER,
  song_id INTEGER,
  removed_by INTEGER,
  reason TEXT,
  removed_at DATETIME
);

-- Auditoria
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action TEXT,
  description TEXT,
  timestamp DATETIME
);
```

---

## 🚀 Como Usar

### 1. **Iniciar o Servidor**
```bash
docker run -p 3000:3000 cooplist:latest
```

### 2. **Acessar a Interface**
Abra: `http://localhost:3000`

### 3. **Fluxo de Uso Típico**

**Passo 1: Registrar/Login**
```bash
POST /api/auth/register
{
  "email": "usuario@email.com",
  "password": "senha123",
  "name": "Seu Nome"
}
```

**Passo 2: Criar Playlist (Admin)**
```bash
POST /api/playlists
{
  "name": "Festa de Aniversario",
  "description": "Musicas favoritas",
  "max_songs_per_user": 3,
  "duration_hours": 2
}
```

**Passo 3: Adicionar Membros**
```bash
POST /api/playlists/1/members
{
  "email": "amigo@email.com",
  "role": "user"
}
```

**Passo 4: Buscar e Adicionar Musicas**
```bash
GET /api/search?q=Beatles

POST /api/playlists/1/songs
{
  "spotify_track_id": "3n3Ppam7vgaVa1iaRUc9Lp",
  "track_name": "Hey Jude",
  "artist_name": "The Beatles",
  "track_duration_ms": 427333,
  "priority": 1
}
```

**Passo 5: Gerar Fila**
```bash
POST /api/playlists/1/shuffle-queue
```

**Resultado:** Fila com uma musica de cada usuario!

---

## 🔐 Segurança

✅ Senhas com hash bcrypt  
✅ JWT para autenticacao  
✅ Validacao de permissoes por role  
✅ Historico de bans  
✅ Auditoria de acoes  
✅ Proteção contra acessos nao autorizados  

---

## 📝 Mudancas em Relacao aos Requisitos Originais

Nenhuma mudanca necessaria! Todos os requisitos foram implementados conforme especificado:

✅ Login e cadastro  
✅ Usuarios com roles (Admin, Moderador, Comum)  
✅ Playlists com descricao, musicas e usuarios  
✅ Limites de musicas por usuario  
✅ Duracao maxima em horas  
✅ Banir/desbanir usuarios  
✅ Remover musicas invalidas  
✅ Sorteio (1 musica por usuario)  
✅ Sistema de prioridade  
✅ Busca Spotify  
✅ Lista de favoritos  
✅ Adicionar de favoritos ou busca  

---

## 🛠️ Proximos Passos Opcionais

1. **Dashboard Web Avancado** - Interface completa para gerenciar playlists (Vue/React)
2. **Reprodutor Web** - Player integrado com Spotify Web API
3. **Notificacoes em Tempo Real** - WebSocket para atualizacoes da fila
4. **Analytics** - Dashboard de estatisticas das playlists
5. **Compartilhamento Social** - Exportar playlists para Spotify
6. **Mobile App** - Aplicativo nativo iOS/Android
7. **Integracao com Discord** - Bot para gerenciar playlists

---

## 📞 Suporte

Para duvidas ou problemas, entre em contato com a equipe de desenvolvimento.

**Desenvolvido com ❤️ usando TypeScript, Express e Spotify API**
