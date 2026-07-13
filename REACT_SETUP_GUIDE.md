# COOPLIST v2.1 - React Dashboard Setup Guide

## Próximas Etapas: Dashboard Frontend

Este documento orienta como criar o dashboard React para completar o projeto.

---

## 1. Criar Projeto React

```bash
# Opção A: Vite (recomendado - mais rápido)
npm create vite@latest cooplist-web -- --template react-ts
cd cooplist-web
npm install

# Opção B: Create React App
npx create-react-app cooplist-web --template typescript
cd cooplist-web
```

---

## 2. Instalar Dependências

```bash
npm install axios socket.io-client react-router-dom
npm install zustand              # State management
npm install recharts             # Analytics charts
npm install lucide-react         # Icons
npm install tailwindcss postcss  # Styling
npm install -D typescript @types/react @types/react-dom
```

---

## 3. Estrutura de Pastas

```
src/
├── components/
│   ├── Layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── DashboardLayout.tsx
│   ├── Auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── Playlists/
│   │   ├── PlaylistCard.tsx
│   │   ├── PlaylistList.tsx
│   │   ├── PlaylistDetail.tsx
│   │   ├── CreatePlaylistModal.tsx
│   │   └── PlaylistSettings.tsx
│   ├── Members/
│   │   ├── MembersList.tsx
│   │   ├── InviteForm.tsx
│   │   └── InviteLinkGenerator.tsx
│   ├── Songs/
│   │   ├── SongList.tsx
│   │   ├── SongCard.tsx
│   │   ├── SpotifySearch.tsx
│   │   └── SongPriorityManager.tsx
│   ├── Analytics/
│   │   ├── AnalyticsDashboard.tsx
│   │   ├── StatsCards.tsx
│   │   ├── ChartsSection.tsx
│   │   ├── EventTimeline.tsx
│   │   └── UserContributionChart.tsx
│   ├── Common/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Loading.tsx
│   │   ├── Toast.tsx
│   │   └── EmptyState.tsx
│   └── Notifications/
│       ├── RealTimeNotifications.tsx
│       └── QueueUpdate.tsx
├── services/
│   ├── api.ts              # Axios instance + methods
│   ├── socket.ts           # Socket.io connection
│   └── auth.ts             # JWT storage
├── stores/
│   ├── authStore.ts        # User auth state (Zustand)
│   ├── playlistStore.ts    # Playlists state
│   ├── songStore.ts        # Songs state
│   └── notificationStore.ts # Notifications
├── hooks/
│   ├── useAuth.ts
│   ├── usePlaylists.ts
│   ├── useSocket.ts
│   ├── useAnalytics.ts
│   └── useSearch.ts
├── types/
│   └── index.ts            # TypeScript interfaces
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── PlaylistPage.tsx
│   ├── AnalyticsPage.tsx
│   └── SettingsPage.tsx
├── utils/
│   ├── formatters.ts
│   ├── validators.ts
│   └── constants.ts
├── App.tsx
├── App.css
└── main.tsx
```

---

## 4. Exemplo: Setup Zustand Store

**stores/playlistStore.ts:**
```typescript
import create from 'zustand';

interface Playlist {
  id: number;
  name: string;
  description: string;
  member_count: number;
  song_count: number;
  spotify_url: string;
}

interface PlaylistStore {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  loading: boolean;
  setPlaylists: (playlists: Playlist[]) => void;
  setCurrentPlaylist: (playlist: Playlist) => void;
  addPlaylist: (playlist: Playlist) => void;
  removePlaylist: (playlistId: number) => void;
}

export const usePlaylistStore = create<PlaylistStore>((set) => ({
  playlists: [],
  currentPlaylist: null,
  loading: false,
  
  setPlaylists: (playlists) => set({ playlists }),
  setCurrentPlaylist: (currentPlaylist) => set({ currentPlaylist }),
  addPlaylist: (playlist) => set((state) => ({
    playlists: [...state.playlists, playlist]
  })),
  removePlaylist: (playlistId) => set((state) => ({
    playlists: state.playlists.filter(p => p.id !== playlistId)
  }))
}));
```

---

## 5. Exemplo: WebSocket Hook

**hooks/useSocket.ts:**
```typescript
import { useEffect } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

let socket: Socket;

export const useSocket = (playlistId: string | number) => {
  useEffect(() => {
    socket = io(SOCKET_URL);
    
    socket.emit('join_playlist', playlistId, localStorage.getItem('userId'));
    
    return () => {
      socket.emit('leave_playlist', playlistId);
    };
  }, [playlistId]);

  const onSongAdded = (callback: (song: any) => void) => {
    socket.on('song_added', callback);
  };

  const onSongRemoved = (callback: (songId: number) => void) => {
    socket.on('song_removed', callback);
  };

  const onQueueUpdated = (callback: (queue: any) => void) => {
    socket.on('queue_updated', callback);
  };

  return { onSongAdded, onSongRemoved, onQueueUpdated };
};
```

---

## 6. Exemplo: Componente de Playlist

**components/Playlists/PlaylistCard.tsx:**
```typescript
import React from 'react';
import { Music, Users, Clock } from 'lucide-react';

interface PlaylistCardProps {
  playlist: any;
  onOpen: (playlistId: number) => void;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({ 
  playlist, 
  onOpen 
}) => {
  return (
    <div 
      onClick={() => onOpen(playlist.id)}
      className="bg-gradient-to-br from-spotify-green to-spotify-dark rounded-lg p-6 cursor-pointer hover:shadow-lg transition-all"
    >
      <h3 className="text-lg font-bold text-white mb-2">
        {playlist.name}
      </h3>
      
      <p className="text-sm text-gray-300 mb-4">
        {playlist.description}
      </p>
      
      <div className="flex justify-between text-sm text-gray-400">
        <div className="flex items-center gap-1">
          <Music size={16} />
          {playlist.song_count} musicas
        </div>
        <div className="flex items-center gap-1">
          <Users size={16} />
          {playlist.member_count} membros
        </div>
      </div>
    </div>
  );
};
```

---

## 7. Exemplo: Analytics Chart

**components/Analytics/ChartsSection.tsx:**
```typescript
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartsSectionProps {
  songsByUser: Array<{ name: string; count: number }>;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ songsByUser }) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h2 className="text-xl font-bold mb-4">Contributacao por Membro</h2>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={songsByUser}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#1DB954" name="Musicas Adicionadas" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
```

---

## 8. Setup Tailwind CSS

**tailwind.config.js:**
```javascript
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        spotify: {
          green: '#1DB954',
          dark: '#191414',
          lightGray: '#282828',
          gray: '#404040'
        }
      }
    }
  },
  plugins: []
};
```

---

## 9. Variáveis de Ambiente (.env.local)

```
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

---

## 10. Rodar o Frontend

```bash
npm run dev
# Acesse: http://localhost:5173 (Vite) ou 3000 (CRA)
```

---

## 11. Funcionalidades Recomendadas

### Dashboard Principal
- [ ] Listar playlists criadas
- [ ] Listar playlists que é membro
- [ ] Criar nova playlist
- [ ] Deletar playlist
- [ ] Buscar playlists

### Página de Playlist
- [ ] Mostrar detalhes
- [ ] Listar membros
- [ ] Listar músicas em fila
- [ ] Sincronizar com Spotify (botão)
- [ ] Ver prioridades

### Gerenciar Membros
- [ ] Convidar por email
- [ ] Gerar link de convite
- [ ] Listar invites pendentes
- [ ] Alterar cargo
- [ ] Remover membro

### Buscar Músicas
- [ ] Campo de busca
- [ ] Resultados em tempo real
- [ ] Adicionar à playlist
- [ ] Adicionar aos favoritos
- [ ] Ver duração

### Analytics
- [ ] Total de músicas
- [ ] Total de membros
- [ ] Duração total
- [ ] Gráfico de contribuição
- [ ] Eventos recentes
- [ ] Estatísticas por usuário

### Notifications
- [ ] Notificações toast
- [ ] Atualizações da fila
- [ ] Novos membros
- [ ] Músicas removidas
- [ ] Sons de notificação (opcional)

---

## 12. Dicas de Desenvolvimento

1. **Componentes Reutilizáveis:**
   - Crie componentes pequenos e isolados
   - Use props para maior flexibilidade
   - Aproveite Zustand para state global

2. **Performance:**
   - Use React.memo para componentes puros
   - Lazy load componentes grandes
   - Minimize re-renders

3. **Acessibilidade:**
   - Use semantic HTML
   - Adicione aria-labels
   - Teste com teclado

4. **Styling:**
   - Use Tailwind para consistência
   - Theme verde Spotify (#1DB954)
   - Dark mode por padrão

5. **Testing:**
   - Vitest para unit tests
   - React Testing Library para componentes
   - Cypress para e2e

---

## 13. Deployment

**Frontend (Vercel):**
```bash
npm install -g vercel
vercel
```

**Backend (Heroku/Railway):**
```bash
git push heroku main
```

---

## Conclusão

Com este guia, você terá um dashboard React completo e funcional integrado ao backend v2.1 do Cooplist.

**Status atual:**
- ✅ Backend: 100% funcional
- ⏳ Frontend: Pronto para ser desenvolvido
- ⏳ React Dashboard: Use este guia

Bom desenvolvimento!
