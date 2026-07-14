# 🎯 O QUE FALTA PARA TERMINAR - Guia Prático

**Data:** 15 de Julho de 2026  
**Versão Atual:** 2.1.4  
**Completo:** 95%  
**Tempo Estimado:** 10-12 horas

---

## 📊 Visão Geral do Restante

```
┌──────────────────────────────────────┐
│  TAREFAS PENDENTES PARA v3.0.0      │
│                                      │
│  ✅ Implementado: 19/20 features    │
│  ❌ Faltando:     1/20 features     │
│  🔧 Bugs Known:   0                 │
│                                      │
│  Progresso: [████████████████░] 95% │
└──────────────────────────────────────┘
```

---

## 🔴 CRÍTICO - Fazer Agora (5 horas)

### 1. WebSocket Real-time Sync
**Prioridade:** 🔴 CRÍTICA  
**Tempo:** 3 horas  
**Status:** Estrutura pronta, eventos não emitidos

**O que fazer:**
```typescript
// 1. Backend - Emitir eventos quando ações acontecem
// src/routes/songs.ts - POST adicionar música
io.to(`playlist:${playlistId}`).emit('song_added', { song, added_by_name: ... });

// src/routes/songs.ts - DELETE remover música
io.to(`playlist:${playlistId}`).emit('song_removed', { song_id: ... });

// src/routes/members.ts - Adicionar membro
io.to(`playlist:${playlistId}`).emit('member_joined', { user_id, role: ... });

// src/routes/members.ts - Remover membro
io.to(`playlist:${playlistId}`).emit('member_left', { user_id, ... });

// 2. Frontend - Os listeners já existem!
// frontend/src/stores/playlistStore.ts (linhas 46-72)
// socket.on('song_added', ...)
// socket.on('song_removed', ...)
// Apenas precisam ser testados
```

**Checklist:**
- [ ] Emitir `song_added` em POST /songs
- [ ] Emitir `song_removed` em DELETE /songs
- [ ] Emitir `member_joined` em POST /members
- [ ] Emitir `member_left` em DELETE /members
- [ ] Testar com 2+ clients simultâneos
- [ ] Validar que fila sincroniza em tempo real

**Teste Manual:**
```
1. Abrir 2 abas do navegador
2. Ambas em http://localhost:5173
3. Login em cada uma
4. Selecionar mesma playlist
5. Em aba 1: Adicionar música
6. Em aba 2: Deve aparecer sem reload
7. Em aba 2: Remover música
8. Em aba 1: Deve desaparecer sem reload
```

---

### 2. Email Notifications
**Prioridade:** 🔴 CRÍTICA  
**Tempo:** 2-3 horas  
**Status:** TODO comentado em invites.ts

**O que fazer:**

#### a. Setup SendGrid (ou Nodemailer)
```bash
# 1. Instalar dependências
npm install nodemailer dotenv

# 2. Adicionar em .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app

# Ou usar SendGrid:
SENDGRID_API_KEY=sua-chave
```

#### b. Criar serviço de email
```typescript
// src/services/emailService.ts (CRIAR)
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendInviteEmail = async (email: string, inviteLink: string, playlistName: string) => {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: `Você foi convidado para ${playlistName} no Cooplist!`,
    html: `
      <h1>Convite para Cooplist</h1>
      <p>Você foi convidado para colaborar na playlist <strong>${playlistName}</strong></p>
      <a href="${inviteLink}">Aceitar Convite</a>
    `
  });
};
```

#### c. Chamar em invites.ts
```typescript
// src/routes/invites.ts linha 82
+ import { sendInviteEmail } from '../services/emailService';

// Antes de res.json():
await sendInviteEmail(email, inviteLink, playlist.name);
```

**Checklist:**
- [ ] Instalar nodemailer
- [ ] Criar emailService.ts
- [ ] Adicionar variáveis de ambiente
- [ ] Chamar ao enviar convite
- [ ] Testar envio real
- [ ] Validar template HTML

---

## 🟡 IMPORTANTE - Fazer Semana que Vem (3-4 horas)

### 3. Testes Automatizados
**Prioridade:** 🟡 IMPORTANTE  
**Tempo:** 3-4 horas  
**Status:** Não existe

**O que fazer:**
```bash
# Instalar Jest
npm install --save-dev jest @types/jest ts-jest

# Criar jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node'
};

# Criar pasta tests/
mkdir tests

# Escrever testes para:
# - Autenticação (login, register)
# - Playlists (CRUD)
# - Membros (add, remove, role)
# - Músicas (add, remove)
```

**Teste mínimo:**
```typescript
// tests/auth.test.ts
import { app } from '../src/index';

describe('Authentication', () => {
  it('should register new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@test.com',
        password: 'password123',
        name: 'Test User'
      });
    expect(response.status).toBe(201);
    expect(response.body.token).toBeDefined();
  });
});
```

**Checklist:**
- [ ] Instalar Jest
- [ ] Criar tests/ folder
- [ ] Escrever testes para APIs críticas
- [ ] Coverage ≥ 80%
- [ ] `npm test` passando

---

### 4. Deployment em Produção
**Prioridade:** 🟡 IMPORTANTE  
**Tempo:** 2-3 horas  
**Status:** Não feito

**Backend - Railway**
```bash
# 1. Criar conta em railway.app
# 2. Conectar GitHub
# 3. Criar novo projeto
# 4. Adicionar variables:
#    - DATABASE_URL
#    - JWT_SECRET
#    - SPOTIFY_CLIENT_ID
#    - SPOTIFY_CLIENT_SECRET
#    - CORS_ORIGIN=https://seu-frontend.vercel.app
# 5. Deploy automático de git push
```

**Frontend - Vercel**
```bash
# 1. Criar conta em vercel.com
# 2. Conectar GitHub
# 3. Importar projeto
# 4. Adicionar variável:
#    - VITE_API_URL=https://seu-backend.railway.app/api
# 5. Deploy automático
```

**Checklist:**
- [ ] Conta Railway criada
- [ ] Conta Vercel criada
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Variáveis de ambiente configuradas
- [ ] Testado em produção

---

## 🟢 OPCIONAL - Fazer Depois (2-3 horas)

### 5. Admin Dashboard
**Prioridade:** 🟢 OPCIONAL  
**Tempo:** 2-3 horas

Admin pode:
- Ver todas as playlists
- Ver estatísticas globais
- Banir usuários
- Ver logs de eventos

---

### 6. Favoritos Pessoais
**Prioridade:** 🟢 OPCIONAL  
**Tempo:** 1 hora

Usuário pode:
- Marcar música como favorita
- Ver seus favoritos
- Adicionar favoritos rapidamente

---

### 7. Performance Optimizações
**Prioridade:** 🟢 OPCIONAL  
**Tempo:** 2-3 horas

- Cache de dados (Redis)
- Code splitting frontend
- Compress responses
- CDN para assets

---

## 📝 COMO FAZER CADA COISA

### WebSocket (o mais importante)

**Passo 1 - Backend emitir eventos**
```typescript
// Adicione em src/routes/songs.ts (após inserir música):
import { io } from '../index';

// Em POST (adicionar música)
io.to(`playlist:${playlistId}`).emit('song_added', {
  song: { id: result.lastID, track_name, artist_name, ... },
  added_by_name: user.name
});

// Em DELETE (remover música)
io.to(`playlist:${playlistId}`).emit('song_removed', {
  song_id: songId
});
```

**Passo 2 - Testar**
```bash
# Terminal 1: Backend
docker run -p 3000:3000 --env-file .env --name cooplist cooplist:latest

# Terminal 2: Frontend
cd frontend && npm run dev

# Abrir 2 abas em http://localhost:5173
# Testar adicionar/remover em tempo real
```

**Passo 3 - Commit**
```bash
git add -A
git commit -m "feat: implement websocket real-time sync for songs"
git tag v2.2.0-rc1
```

---

### Email (segundo mais importante)

**Passo 1 - Serviço de email**
```bash
npm install nodemailer
```

**Passo 2 - Criar arquivo**
```typescript
// src/services/emailService.ts
```

**Passo 3 - Usar em invites**
```typescript
// src/routes/invites.ts
await sendInviteEmail(...);
```

**Passo 4 - Testar**
```bash
# Gerar convite
# Verificar se email foi recebido
```

---

## 🚀 TIMELINE RECOMENDADA

```
15/07 (Hoje)
├─ ✅ v2.1.4 concluído (95%)
└─ Documentação completa

16/07 (Amanhã)
├─ WebSocket sync (3h)
├─ Email notifications (2h)
└─ Testes (1h)
└─ Resultado: v2.2.0

17-19/07 (Semana)
├─ Testes completos (4h)
├─ Deploy em produção (3h)
└─ Resultado: v3.0.0 em produção

20+/07 (Futuro)
├─ Admin dashboard
├─ Performance opts
└─ Mobile app
```

---

## 📋 CHECKLIST FINAL

### Antes de v2.2.0
- [ ] WebSocket funcionando
- [ ] Emails enviados
- [ ] Testes passando
- [ ] Commit v2.2.0

### Antes de v3.0.0
- [ ] Deploy em produção
- [ ] CI/CD funcionando
- [ ] Monitoramento (Sentry)
- [ ] Documentação produção

### Antes de v3.1.0
- [ ] Admin dashboard
- [ ] Favoritos pessoais
- [ ] Performance otimizações

---

## 💡 DICAS IMPORTANTES

1. **WebSocket é simples:** Listeners já existem, apenas emita events
2. **Email pode usar Gmail:** Apenas gere app password
3. **Testes salvam tempo:** Valida mudanças futuras
4. **Deploy é rápido:** Railway/Vercel automatizam tudo
5. **Performance depois:** Primeiro funcional, depois otimiza

---

## 🎓 Recursos

### Documentação
- WebSocket: https://socket.io/docs/
- Jest: https://jestjs.io/
- Railway: https://railway.app/docs
- Vercel: https://vercel.com/docs
- Nodemailer: https://nodemailer.com/

### Repositório
- Issues: Criar para tracking
- Branches: feature/websocket, feature/email
- Tags: v2.2.0-rc1, v2.2.0

---

## ❓ FAQ

**P: Por quanto tempo o projeto levará?**  
R: WebSocket + Email = 5 horas. Deploy + testes = 5 horas. Total: ~10h de trabalho.

**P: Em que ordem devo fazer?**  
R: WebSocket primeiro (mais complexo), depois email, depois deploy.

**P: Preciso parar o backend?**  
R: Não, pode desenvolver enquanto roda. Docker reinicia automaticamente.

**P: Como testo sem quebrar production?**  
R: Use feature branches. Mergia apenas após testes.

**P: Onde colocar o código novo?**  
R: Backend em `src/`, frontend em `frontend/src/`, testes em `tests/`.

---

**Próximo Passo:** Amanhã começar com WebSocket!  
**Desenvolvido por:** csiemann  
**Data:** 15/07/2026
