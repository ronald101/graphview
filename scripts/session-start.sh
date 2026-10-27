#!/bin/bash
# Runs when a Claude Code session starts or resumes (see .claude/settings.json).
# In cloud sessions it restores what a fresh machine lacks: the npm packages and the
# test browser. It never fails the session start; problems are written to the log
# and reported by Claude Code.
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi
cd "$CLAUDE_PROJECT_DIR" || exit 0
LOG="$CLAUDE_PROJECT_DIR/.session-start.log"
{
  echo "session start: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ -f package-lock.json ] && [ ! -d node_modules ]; then
    npm ci --no-audit --no-fund || echo "npm ci failed"
  fi
  if [ -d node_modules/@playwright/test ] || [ -d node_modules/playwright ]; then
    npx playwright install --with-deps chromium || npx playwright install chromium || echo "browser install failed"
  fi
} >> "$LOG" 2>&1
exit 0
