#!/usr/bin/env node

/**
 * cron-update.js
 * Runs at midnight (00:00) daily. Generates tomorrow's schedule and deploys to Vercel.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function updateScheduleAndDeploy() {
  try {
    console.log(`🕐 Starting schedule update at ${new Date().toISOString()}`);

    // Step 1: Generate the schedule
    const generateScript = path.join(__dirname, 'generate-schedule.js');
    const generateOutput = execSync(`node ${generateScript}`, { encoding: 'utf8' });
    console.log(generateOutput);

    // Step 2: Verify the file was created
    const schedulesDir = path.join(__dirname, '..', 'schedules');
    const todayJsonPath = path.join(schedulesDir, 'today.json');
    
    if (!fs.existsSync(todayJsonPath)) {
      throw new Error('Schedule file was not created');
    }

    const schedule = JSON.parse(fs.readFileSync(todayJsonPath, 'utf8'));
    console.log(`✅ Schedule generated for ${schedule.date}`);

    // Step 3: Deploy to Vercel
    console.log('🚀 Deploying to Vercel...');
    const deployOutput = execSync('cd ~/Developer/day-planner && vercel deploy --prod 2>&1', {
      encoding: 'utf8',
      shell: '/bin/zsh'
    });
    
    if (deployOutput.includes('ERROR') || deployOutput.includes('error')) {
      console.warn('⚠️ Deploy output contained errors:', deployOutput);
    } else {
      console.log('✅ Deployed to Vercel');
    }

    console.log(`\n✅ Schedule update complete at ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Schedule update failed: ${err.message}`);
    process.exit(1);
  }
}

updateScheduleAndDeploy();
