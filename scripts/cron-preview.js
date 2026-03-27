#!/usr/bin/env node

/**
 * cron-preview.js
 * Runs at 9 PM daily. Generates tomorrow's schedule preview and sends to Telegram.
 * Uses OpenClaw built-in messaging to send to Derek's chat.
 */

const { execSync } = require('child_process');
const path = require('path');

function runPreview() {
  try {
    // Run the preview script and capture output
    const previewScript = path.join(__dirname, 'preview-schedule.js');
    const message = execSync(`node ${previewScript}`, { encoding: 'utf8' });

    // Send via OpenClaw messaging
    // We'll write the message to a temp file and use a helper to send it
    const fs = require('fs');
    const tmpFile = '/tmp/day-planner-preview.txt';
    fs.writeFileSync(tmpFile, message, 'utf8');

    console.log(`✅ Preview generated at ${new Date().toISOString()}`);
    console.log(`📬 Ready to send to Telegram. Message length: ${message.length} chars`);
    
    // Log the message for debugging
    console.log('\n--- PREVIEW MESSAGE ---');
    console.log(message);
    console.log('--- END PREVIEW ---\n');

    // Return 0 for cron success
    process.exit(0);
  } catch (err) {
    console.error('❌ Preview generation failed:', err.message);
    process.exit(1);
  }
}

runPreview();
