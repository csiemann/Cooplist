# COOPLIST v2.1 - Spotify Playlist Manager

## Resumo da Restructuração

O projeto foi completamente reconstruído para focar **exclusivamente em gerenciar playlists no Spotify**. Todas as funcionalidades de usuários, convites, atualizações em tempo real e analytics foram implementadas.

---

## ✨ Principais Mudanças

### ✅ **1. Integração Spotify Simplificada**
- **Uma única conta Spotify** usada para criar/gerenciar playlists
- Credenciais do desenvolvedor apenas para API (busca e CRUD de playlists)
- Sincronização automática com Spotify

**Vantagens:**
- Sem necessidade de OAuth2 para cada usuário
- Playlists gerenciadas centralmente
- API simplificada e segura

### ✅ **2. Sistema de Convites**

**Dois tipos de convite:**

**Por Email:**
```bash
POST /api/playlists/:playlistId/invite-email
{
  "email": "amigo@email.com",
  "role": "user"
}
```

**Por Link Gerável:**
```bash
POST /api/playlists/:playlistId/invite-link
{
  "role": "user",
  "expiresIn": 7  // dias
}

Resposta: link de convite único reutilizável
```

**Aceitar Convite:**
```bash
POST /api/invites/accept/:token
```

### ✅ **3. WebSocket em Tempo Real**

**Eventos emitidos automaticamente:**

```javascript
// Cliente conecta a uma playlist
socket.emit('join_playlist', playlistId, userId);

// Servidor emite quando há atualizações
socket.on('song_added', (song) => {...})
socket.on('song_removed', (songId) => {...})
socket.on('song_updated', (songId, priority) => {...})
socket.on('queue_updated', (queue) => {...})
socket.on('user_joined', (userId) => {...})
socket.on('user_left', (userId) => {...})
```

### ✅ **4. Analytics Dashboard**

**Estatísticas disponíveis:**

```bash
GET /api/playlists/:playlistId/analytics
```

**Retorna:**
```json
{
  "stats": {
    "total_songs": 42,
    "total_members": 5,
    "total_duration_hours": 3.5,
    "songs_by_user": [
      { "name": "João", "count": 12 },
      { "name": "Maria", "count": 10 }
    ],
    "recent_events": [
      { "event_type": "song_added", "user_name": "João", "created_at": "..." },
      { "event_type": "user_joined", "user_name": "Pedro", "created_at": "..." }
    ]
  }
}
```

**Tipos de eventos registrados:**
- `playlist_created`
- `playlist_deleted`
- `song_added`
- `song_removed`
- `user_joined`
- `member_removed`
- `queue_shuffled`

---

## 🏗️ Arquitetura

### **Backend:**
- Express.js com TypeScript
- SQLite3 para persistência
- Socket.io para real-time
- Axios para Spotify API
- JWT para autenticação

### **Banco de Dados (Simplificado):**

```sql
users (id, email, password, name)
  ↓
playlists (id, spotify_id, name, description, created_by, max_songs_per_user, duration_hours)
  ↓
playlist_members (playlist_id, user_id, role)
  ↓
playlist_songs (playlist_id, spotify_track_id, track_name, artist_name, added_by, priority, position_in_queue)

invites (playlist_id, email/token, role, created_by, expires_at, used_at)
user_favorites (user_id, spotify_track_id, track_name, artist_name)
analytics (playlist_id, event_type, user_id, data, created_at)
```

---

## 🔌 API Endpoints

### **Autenticação**
```
POST /api/auth/register
POST /api/auth/login
```

### **Playlists**
```
GET    /api/playlists                      - Listar minhas playlists
POST   /api/playlists                      - Criar playlist
GET    /api/playlists/:playlistId          - Detalhes
DELETE /api/playlists/:playlistId          - Deletar (admin)
POST   /api/playlists/:playlistId/shuffle-queue - Reordenar fila
```

### **Convites**
```
POST   /api/playlists/:playlistId/invite-email  - Convidar por email
POST   /api/playlists/:playlistId/invite-link   - Gerar link convite
GET    /api/playlists/:playlistId/invites       - Listar convites
DELETE /api/playlists/:playlistId/invites/:id   - Revogar convite
POST   /api/invites/accept/:token               - Aceitar convite
```

### **Músicas**
```
POST   /api/playlists/:playlistId/songs          - Adicionar música
DELETE /api/playlists/:playlistId/songs/:songId  - Remover (mod/admin)
PATCH  /api/playlists/:playlistId/songs/:songId  - Alterar prioridade
```

### **Membros**
```
GET    /api/playlists/:playlistId/members           - Listar
PATCH  /api/playlists/:playlistId/members/:memberId - Alterar role (admin)
DELETE /api/playlists/:playlistId/members/:memberId - Remover (mod/admin)
```

### **Analytics**
```
GET /api/playlists/:playlistId/analytics - Estatísticas
```

### **Busca**
```
GET    /api/search?q=query&limit=20    - Buscar no Spotify
GET    /api/search/favorites           - Listar favoritos
POST   /api/search/favorites           - Adicionar aos favoritos
DELETE /api/search/favorites/:id       - Remover dos favoritos
```

---

## 🎯 Fluxo de Uso

### **1. Criar Playlist**
```bash
1. Usuário registra/faz login
2. Clica em "Nova Playlist"
3. Define nome, descrição, limites
4. Playlist é criada no Spotify automaticamente
5. Usuário recebe ID da playlist
```

### **2. Convidar Membros**

**Opção A - Por Email:**
```bash
1. Admin/Moderador vai em "Gerenciar Membros"
2. Insere email e clica "Convidar"
3. Email é enviado com link de convite
4. Usuário clica no link e é adicionado
```

**Opção B - Por Link:**
```bash
1. Admin/Moderador gera um link unique
2. Compartilha o link com qualquer pessoa
3. Qualquer pessoa pode usar o link para entrar
4. Link expira após X dias (configurável)
```

### **3. Adicionar Músicas**
```bash
1. Usuário busca "Beatles" na API Spotify
2. Resultados aparecem em tempo real
3. Clica em uma música para adicionar
4. Opcional: define prioridade na fila
5. Outros membros veem a adição instantaneamente (WebSocket)
```

### **4. Ver Analytics**
```bash
1. Clica em "Analytics"
2. Vê estatísticas:
   - Total de músicas
   - Contribuição por membro
   - Duração total da playlist
   - Histórico de eventos
3. Gráficos em tempo real
```

---

## 🚀 Configuração

### **Variáveis de Ambiente (.env)**
```env
SPOTIFY_CLIENT_ID=seu_client_id
SPOTIFY_CLIENT_SECRET=seu_client_secret
JWT_SECRET=sua_chave_secreta
PORT=3000
NODE_ENV=development
```

### **Obter Credenciais Spotify**
1. Acesse https://developer.spotify.com/dashboard
2. Crie uma aplicação
3. Copie Client ID e Client Secret
4. Adicione em .env

---

## 📊 Mudanças vs v2.0

| Aspecto | v2.0 | v2.1 |
|--------|------|------|
| **Spotify** | Opcional OAuth2 por usuário | Uma conta centralizada |
| **Invites** | Sem suporte | Email + Link |
| **Real-time** | Não | WebSocket completo |
| **Analytics** | Básico | Dashboard avançado |
| **Interface** | HTML simples | Preparado para React |
| **Foco** | Multipropósito | Spotify apenas |

---

## 🎨 Dashboard React (Próximo)

**Componentes que serão criados:**
- DashboardLayout (navbar, sidebar)
- PlaylistCard (visualizar playlists)
- PlaylistDetail (ver detalhes + membros)
- SongList (fila de reprodução)
- InviteManager (gerenciar convites)
- Analytics Dashboard (gráficos)
- Search Bar (buscar no Spotify)
- Favorites (favoritos)
- RealTimeNotifications (WebSocket)

---

## 🔐 Segurança

✅ Senhas com hash bcrypt  
✅ JWT com expiração  
✅ Validação de permissões por role  
✅ Convites com tokens únicos  
✅ Auditoria de eventos  
✅ CORS configurado  
✅ SQL injection protection (prepared statements)  

---

## 📈 Próximos Passos

1. **React Dashboard** (UI completa)
2. **Envio de emails** para convites
3. **Gráficos avançados** (chart.js/recharts)
4. **Integração com Discord** (webhooks)
5. **Mobile app** (React Native)
6. **Exportar playlists** para Spotify direto

---

**Desenvolvido por:** csiemann  
**Email:** caetanosiemann@gmail.com  
**Versão:** 2.1.0

