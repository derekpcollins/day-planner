#!/usr/bin/env node

/**
 * cron-send-preview.js
 * 9 PM daily cron job for day-planner
 * Generates tomorrow's schedule preview and sends to Telegram via OpenClaw messaging
 * 
 * This should be scheduled to run at 9 PM (21:00) EDT every day.
 * It will be triggered by OpenClaw's cron system and can send messages back.
 */

const { execSync } = require('child_process');
const path = require('path');

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] Starting 9 PM preview generation...`);

    // Run the preview script
    const previewScript = path.join(__dirname, 'preview-schedule.js');
    const previewOutput = execSync(`node ${previewScript}`, { encoding: 'utf8' });

    // The preview output is Telegram-formatted markdown
    // We need to return this in a format that OpenClaw can send
    console.log('\n=== PREVIEW MESSAGE FOR TELEGRAM ===\n');
    console.log(previewOutput);
    console.log('\n=== END PREVIEW ===\n');

    // For OpenClaw integration, the message will be picked up from stdout
    // and the calling cron job/session will handle sending it

    process.exit(0);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Preview generation failed:`, err.message);
    process.exit(1);
  }
}

main();
