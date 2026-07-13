# Cooplist - Music Collaboration Platform

API backend com integração Spotify, autenticação JWT e CRUD de playlists colaborativas.

## Setup

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

## Env Variables

```
SPOTIFY_CLIENT_ID=seu_client_id
SPOTIFY_CLIENT_SECRET=seu_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback
JWT_SECRET=sua_chave_secreta
```
