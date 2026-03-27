#!/bin/bash

# send-preview-telegram.sh
# Runs the preview script and sends output to Telegram via OpenClaw messaging

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Run preview script
echo "[$(date)] Generating preview..." >> /tmp/day-planner.log
MESSAGE=$("$SCRIPT_DIR/cron-preview.js" 2>&1)

if [ $? -eq 0 ]; then
  echo "[$(date)] Preview generated successfully" >> /tmp/day-planner.log
  
  # Send via OpenClaw messaging to Derek's chat (8619316468)
  # This will be picked up by the gateway and routed to Telegram
  cat > /tmp/day-planner-msg.txt << EOF
$MESSAGE
EOF

  echo "[$(date)] Message ready for sending to Telegram" >> /tmp/day-planner.log
  echo "$MESSAGE"
else
  echo "[$(date)] Preview generation FAILED" >> /tmp/day-planner.log
  exit 1
fi
