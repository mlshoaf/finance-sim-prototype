#!/usr/bin/env bash
# .devcontainer/start.sh
# Runs every time the Codespace is started or resumed (postStartCommand).
# Steps:
#   1. Pull the latest code from main (fast-forward only)
#   2. Install any new packages
#   3. Rebuild native modules for the current Node.js version
#   4. Start the server (skips if one is already running)
#
# NOTE: We intentionally do NOT use "set -e" here.  Individual steps may fail
# (e.g. git pull when offline, npm rebuild on a cached image) but the server
# must always attempt to start regardless.

LOG=/tmp/finance-sim.log

# ── 1. Pull latest code ────────────────────────────────────────────────────────
echo "[start.sh] Pulling latest code from origin/main..." | tee -a "$LOG"
if git pull --ff-only origin main >> "$LOG" 2>&1; then
  echo "[start.sh] Pull succeeded." | tee -a "$LOG"
else
  echo "[start.sh] WARNING: git pull failed (see $LOG). Starting with existing code." | tee -a "$LOG"
fi

# ── 2. Install packages ────────────────────────────────────────────────────────
echo "[start.sh] Running npm install..." | tee -a "$LOG"
npm install >> "$LOG" 2>&1 || echo "[start.sh] WARNING: npm install failed (see $LOG)." | tee -a "$LOG"

# ── 3. Rebuild native modules (prevents better-sqlite3 ABI mismatch) ──────────
echo "[start.sh] Running npm rebuild..." | tee -a "$LOG"
npm rebuild >> "$LOG" 2>&1 || echo "[start.sh] WARNING: npm rebuild failed (see $LOG). Server will still attempt to start." | tee -a "$LOG"

# ── 4. Start server (only if not already running) ─────────────────────────────
if pgrep -f 'node server.js' > /dev/null 2>&1; then
  echo "[start.sh] Server already running — skipping start." | tee -a "$LOG"
else
  echo "[start.sh] Starting server..." | tee -a "$LOG"
  nohup npm start >> "$LOG" 2>&1 &
  echo "[start.sh] Server launched (PID $!). Logs: $LOG" | tee -a "$LOG"
fi
