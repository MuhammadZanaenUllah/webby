#!/bin/bash

# Configuration
REMOTE_SERVER="root@65.109.113.17"
LOCAL_PORT=3307
REMOTE_PORT=3306

echo "--- Webby Live Backend Bridge ---"

# 1. Check if SSH tunnel is running
if ps aux | grep "$LOCAL_PORT:127.0.0.1:$REMOTE_PORT" | grep -v grep > /dev/null
then
    echo "✔ SSH Tunnel is already active."
else
    echo "Establishing SSH Tunnel to $REMOTE_SERVER..."
    ssh -N -L $LOCAL_PORT:127.0.0.1:$REMOTE_PORT $REMOTE_SERVER &
    sleep 2
    if ps aux | grep "$LOCAL_PORT:127.0.0.1:$REMOTE_PORT" | grep -v grep > /dev/null
    then
        echo "✔ SSH Tunnel established successfully."
    else
        echo "✘ Failed to establish SSH Tunnel. Please check your SSH connection."
        exit 1
    fi
fi

# 2. Clear local caches for fresh data
echo "Clearing local caches..."
php artisan optimize:clear

# 3. Start Frontend & Backend
echo "Launching local frontend (Vite) and bridge backend (Laravel)..."
npx concurrently --kill-others \
  "php artisan serve --port=8001" \
  "npm run dev"
