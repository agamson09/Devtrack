#!/bin/bash
set -e

PROJECT_DIR="/var/www/devtrack"

echo "=== Project already exists, installing missing deps ==="
cd $PROJECT_DIR

echo "=== Installing dependencies with legacy-peer-deps ==="
npm install tailwindcss@3 postcss autoprefixer --legacy-peer-deps 2>&1
npm install mysql2 jsonwebtoken bcryptjs cookie --legacy-peer-deps 2>&1
npm install socket.io socket.io-client --legacy-peer-deps 2>&1
npm install nodemailer node-telegram-bot-api --legacy-peer-deps 2>&1
npm install recharts @hello-pangea/dnd --legacy-peer-deps 2>&1
npm install next-auth --legacy-peer-deps 2>&1

echo "=== Initializing Tailwind ==="
npx tailwindcss init -p 2>&1 || true

echo "=== Creating directory structure ==="
mkdir -p pages/api/auth
mkdir -p pages/api/projects
mkdir -p pages/api/tasks
mkdir -p pages/api/users
mkdir -p pages/api/notifications
mkdir -p pages/api/webhooks
mkdir -p pages/dashboard
mkdir -p pages/task
mkdir -p components/layout
mkdir -p components/dashboard
mkdir -p components/tasks
mkdir -p components/common
mkdir -p lib
mkdir -p public/images
mkdir -p styles

echo "=== Done ==="
ls -la $PROJECT_DIR
