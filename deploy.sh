#!/bin/bash

# Configuration
REMOTE_SERVER="root@65.109.113.17"
REMOTE_PATH="/var/www/webby"
BRANCH="main"

echo "🚀 Starting Production Deployment..."

# 1. Local check
echo "Step 1: Pushing latest changes to GitHub..."
git push origin $BRANCH

# 2. Remote Deployment
echo "Step 2: Connecting to $REMOTE_SERVER and pulling changes..."
ssh $REMOTE_SERVER << EOF
    cd $REMOTE_PATH
    
    # Check if we are in a git repository
    if [ ! -d .git ]; then
        echo "✘ Error: $REMOTE_PATH is not a git repository."
        exit 1
    fi

    # Pull latest changes
    echo "--- Pulling latest code ---"
    git pull origin $BRANCH

    # Install dependencies
    echo "--- Installing dependencies & Building assets ---"
    cd Install
    
    echo "--- Installing PHP dependencies ---"
    composer install --no-dev --optimize-autoloader
    
    echo "--- Installing JS dependencies ---"
    npm install
    
    echo "--- Building assets ---"
    npm run build
    
    # Ensure builder binary is executable (path adjusted for being inside Install/)
    chmod +x ../Builder/prebuilt/webby-builder-linux

    # Database migrations (Artisan is in the Install directory)
    echo "--- Running database migrations ---"
    php artisan migrate --force

    # Clear and rebuild caches
    echo "--- Optimizing Laravel ---"
    php artisan optimize:clear
    php artisan optimize
    php artisan storage:link
    cd ..

    # Restart background services
    echo "--- Restarting Systemd Services ---"
    # Using more flexible service name patterns or explicit names
    systemctl restart webby-reverb || echo "⚠️ Warning: webby-reverb service not found"
    systemctl restart webby-worker || echo "⚠️ Warning: webby-worker service not found"
    systemctl restart webby-builder || echo "⚠️ Warning: webby-builder service not found"

    echo "✔ Remote deployment steps completed successfully."
EOF

if [ $? -eq 0 ]; then
    echo "✅ Deployment finished successfully!"
else
    echo "❌ Deployment failed. Please check the logs above."
fi
