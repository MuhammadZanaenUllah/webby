#!/bin/bash

# Navigate to the Install directory and run the unified start command
# This starts:
# 1. Vite (Frontend)
# 2. Laravel (Backend)
# 3. Laravel Reverb (Real-time events)
# 4. Laravel Queue (Background jobs)
# 5. Go Builder (AI Core)

echo "Starting Webby Project..."
# cd "$(dirname "$0")/Install" && npm run start:all
cd "$(dirname "$0")/Install" && npm run dev:all
