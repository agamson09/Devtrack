# DevTrack — Next.js app with custom Socket.IO server
FROM node:22-bookworm-slim

# node-pty requires native build tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy application source
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

EXPOSE 3000

# server.js = Next.js + Socket.IO + HTTPS support
CMD ["node", "server.js"]
