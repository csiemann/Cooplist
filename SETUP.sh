#!/bin/bash

# COOPLIST v2.1 - Setup Guide

echo "=========================================="
echo "  COOPLIST v2.1 - Setup"
echo "=========================================="
echo ""

# 1. Obter credenciais Spotify
echo "1. Obtenha suas credenciais Spotify:"
echo "   - Acesse: https://developer.spotify.com/dashboard"
echo "   - Crie uma app"
echo "   - Copie Client ID e Client Secret"
echo ""

# 2. Criar arquivo .env
echo "2. Criando arquivo .env..."
cat > .env << EOF
# Spotify API Credentials
SPOTIFY_CLIENT_ID=seu_client_id_aqui
SPOTIFY_CLIENT_SECRET=seu_client_secret_aqui

# JWT Secret
JWT_SECRET=sua_chave_secreta_bem_complexa_aqui

# Server
PORT=3000
NODE_ENV=development
EOF

echo ".env criado com sucesso!"
echo ""

# 3. Instruções finais
echo "3. Próximas etapas:"
echo "   a) Edite .env com suas credenciais Spotify"
echo "   b) Execute: docker run -p 3000:3000 --env-file .env cooplist:latest"
echo "   c) Acesse: http://localhost:3000"
echo ""

echo "=========================================="
echo "  Setup completo!"
echo "=========================================="
echo ""

# Exemplos de uso
echo "EXEMPLOS DE USO:"
echo ""
echo "1. Criar Playlist:"
echo "   curl -X POST http://localhost:3000/api/playlists \\"
echo "     -H 'Authorization: Bearer TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"name\":\"Minha Playlist\",\"description\":\"Minhas musicas favoritas\"}'"
echo ""

echo "2. Convidar por Email:"
echo "   curl -X POST http://localhost:3000/api/playlists/1/invite-email \\"
echo "     -H 'Authorization: Bearer TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"amigo@email.com\",\"role\":\"user\"}'"
echo ""

echo "3. Gerar Link de Convite:"
echo "   curl -X POST http://localhost:3000/api/playlists/1/invite-link \\"
echo "     -H 'Authorization: Bearer TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"role\":\"user\",\"expiresIn\":7}'"
echo ""

echo "4. Buscar Musicas:"
echo "   curl 'http://localhost:3000/api/search?q=Beatles' \\"
echo "     -H 'Authorization: Bearer TOKEN'"
echo ""

echo "5. Obter Analytics:"
echo "   curl http://localhost:3000/api/playlists/1/analytics \\"
echo "     -H 'Authorization: Bearer TOKEN'"
echo ""

echo "Documentacao completa em: RESTRUCTURE_v2.1.md"
