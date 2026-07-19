docker stop cooplist-app-container
docker rm cooplist-app-container
docker build -t cooplist-app:latest .
docker run -d -p 5173:3000 --env-file .env --name cooplist-app-container cooplist-app:latest

