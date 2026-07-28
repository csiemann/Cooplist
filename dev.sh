#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Backend ---
echo "--- Setting up Backend ---"
npm install

echo "--- Starting Backend (in background) ---"
npm run dev &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# --- Frontend ---
echo "--- Setting up Frontend ---"
cd frontend
npm install

echo "--- Starting Frontend ---"
# This will run in the foreground
npm run dev

# --- Cleanup ---
echo "--- Shutting down Backend ---"
kill $BACKEND_PID
