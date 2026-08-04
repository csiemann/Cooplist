# 📋 COOPLIST - ROADMAP E CONTEXTO PARA PRÓXIMA SESSÃO

Este documento especifica em detalhes os próximos passos de desenvolvimento do **Cooplist**, para servir de contexto imediato no próximo prompt.

---

## 🎯 OBJETIVOS DA PRÓXIMA SESSÃO

### 1. 🎨 Refatorar Tela de Favoritos (`FavoritesModal` / `FavoritesView`)
- **Problema Atual:** A interface da tela de favoritos necessita de um layout mais moderno, responsivo e fluido.
- **Implementação esperada:**
  - Interface estilo card/grade ou lista moderna com capas, nome da música, artista e duração.
  - Busca integrada do Spotify com opção instantânea de favoritar/desfavoritar (`❤️` / `🤍`).
  - Filtro rápido ou busca local dentro da lista de favoritos do usuário.

### 2. ⚡ Atalho Rápido para Adicionar Favorita na Playlist
- **Objetivo:** Permitir adicionar uma música favoritada diretamente à playlist atual com 1 clique.
- **Implementação esperada:**
  - Na lista de favoritos, adicionar um botão de destaque `+ Adicionar à Playlist` (usando a `selectedPlaylist`).
  - Caso o usuário não tenha uma playlist selecionada no menu, exibir um dropdown rápido com as playlists em que ele é membro.
  - Notificação Toast instantânea ao adicionar.

### 3. 🎛️ Tela/Painel de Prioridade Pessoal por Membro
- **Objetivo:** Cada usuário deve conseguir gerenciar a ordem das músicas que **somente ele** adicionou na playlist.
- **Implementação esperada:**
  - Nova aba ou modal "Minhas Músicas nesta Playlist".
  - Listar apenas as músicas onde `playlist_id = X` e `added_by = user.id`.
  - Permitir alterar a ordem de prioridade (botões de subir/descera ⬆️/⬇️ ou alterar número de prioridade).
  - Atualizar a coluna `priority` em `playlist_songs` no backend.

### 4. 🔀 Algoritmo de Ordenação Democrática da Fila
- **Objetivo:** A fila da playlist deve ser ordenada dinamicamente aplicando as 3 regras do projeto:
  1. **Round-Robin entre usuários:** 1 música de cada usuário por vez (Usuário A -> Usuário B -> Usuário C -> Usuário A...), evitando monopolização da fila.
  2. **Prioridade do usuário:** Respeitar a ordem de prioridade definida pelo próprio usuário no Passo 3.
  3. **Músicas mais favoritadas:** Usar o total de favoritos dos membros como critério de ordenação/desempate secundário.
- **Implementação esperada:**
  - Criar um algoritmo no backend (`src/services/queueService.ts` ou em `routes/playlists.ts`) que ordene as músicas antes de enviar na resposta da API e no WebSocket.

### 5. 🟢 Exportar / Criar Playlist Oficial no Spotify
- **Objetivo:** Botão final para publicar a playlist colaborativa diretamente na conta do Spotify.
- **Implementação esperada:**
  - Botão "Criar no Spotify" ou "Sincronizar no Spotify".
  - Invocar a API do Spotify via `spotifyService` criando a playlist na conta do usuário logado.
  - Enviar todas as faixas mantendo **rigorosamente a mesma ordem** gerada pelo algoritmo do Passo 4.
  - Retornar o link público (`https://open.spotify.com/playlist/...`).

---

## 📂 ESTRUTURA E ARQUIVOS CHAVE

- `src/routes/favorites.ts`: Endpoints de favoritos (`GET /`, `POST /`, `DELETE /:id`, `DELETE /track/:spotifyTrackId`).
- `src/routes/playlists.ts`: Endpoints de playlists e ordenação da fila.
- `src/routes/songs.ts`: Gerenciamento de faixas e prioridades.
- `frontend/src/components/FavoritesModal.tsx`: Componente de exibição dos favoritos do usuário.
- `frontend/src/components/PlaylistDetails.tsx`: Detalhes da playlist e membros.
- `frontend/src/pages/DashboardPage.tsx`: Dashboard principal com fila, estatísticas e busca Spotify.
