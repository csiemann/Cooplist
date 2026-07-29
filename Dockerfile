FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY src ./src

RUN npm run build

# Build frontend (Vite) inside builder
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend ./frontend
RUN cd frontend && npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY jest.config.js ./

RUN npm install

COPY src ./src
COPY tests ./tests

COPY --from=builder /app/dist ./dist
# Copy built frontend to public so Express can serve it
COPY --from=builder /app/frontend/dist ./public

EXPOSE 3000

CMD ["node", "dist/index.js"]
