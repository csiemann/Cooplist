@echo off
docker rm -f cooplist-app-container
docker build -t cooplist:latest .
docker run -d -p 3000:3000 -p 5173:3000 --env-file .env --name cooplist-app-container cooplist:latest
docker logs -f cooplist-app-container