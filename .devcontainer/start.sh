#!/usr/bin/env bash
# .devcontainer/start.sh
# Runs every time the Codespace is started or resumed (postStartCommand).
# Steps:
#   1. Pull the latest code from main (fast-forward only)
#   2. Install any new packages
#   3. Rebuild native modules for the current Node.js version
#   4. Start the server (skips if one is already running)

set -euo pipefail

LOG=/tmp/finance-sim.log

# ── 1. Pull latest code ────────────────────────────────────────────────────────
echo "[start.sh] Pulling latest code from origin/main..." | tee -a "$LOG"
if git pull --ff-only origin main 2>> "$LOG"; then
  echo "[start.sh] Pull succeeded." | tee -a "$LOG"
else
  echo "[start.sh] WARNING: git pull failed (see above). Starting with existing code." | tee -a "$LOG"
fi

# ── 2. Install packages ────────────────────────────────────────────────────────
echo "[start.sh] Running npm install..." | tee -a "$LOG"
npm install --prefer-offline >> "$LOG" 2>&1

# ── 3. Rebuild native modules (prevents better-sqlite3 ABI mismatch) ──────────
echo "[start.sh] Running npm rebuild..." | tee -a "$LOG"
npm rebuild >> "$LOG" 2>&1

# ── 4. Start server (only if not already running) ─────────────────────────────
if pgrep -f 'node server.js' > /dev/null 2>&1; then
  echo "[start.sh] Server already running — skipping start." | tee -a "$LOG"
else
  echo "[start.sh] Starting server..." | tee -a "$LOG"
  nohup npm start >> "$LOG" 2>&1 &
fi
