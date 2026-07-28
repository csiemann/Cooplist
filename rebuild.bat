@echo off
docker rm -f cooplist-backend
docker build -t cooplist:latest .
docker run -d -p 3000:3000 --env-file .env --name cooplist-backend cooplist:latest
docker logs -f cooplist-backend