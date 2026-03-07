# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# Install build tools needed by better-sqlite3 (native module)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# package-lock.json is required by npm ci for reproducible installs
COPY package*.json ./
RUN npm ci

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Copy installed modules (including compiled native bindings)
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
