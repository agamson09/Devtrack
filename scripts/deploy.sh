#!/bin/bash

set -e

echo "Starting deployment..."

echo "Building application..."
npm run build

echo "Checking if PM2 process exists..."
if pm2 describe devtrack > /dev/null 2>&1; then
  echo "Restarting existing PM2 process..."
  pm2 restart devtrack
else
  echo "Starting new PM2 process..."
  pm2 start server.js --name devtrack
fi

echo ""
echo "Deployment completed successfully!"
echo "DevTrack is running on port ${PORT:-3000}"
