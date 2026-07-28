# Gemini Project Context

## Execution Environment

This project runs inside a Docker container. All commands related to execution, testing, or package management should be run within this container.

- **Container Name:** `cooplist-app-container`

To run a command inside the container, use the following pattern:

```bash
docker exec -it cooplist-app-container <your_command>
```
