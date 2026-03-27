#!/usr/bin/env node
/**
 * preview-schedule.js
 * 9 PM day preview — generates a Telegram message summarizing tomorrow's plan.
 * Reads: remindctl (reminders) + Obsidian Projects vault
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Config ──────────────────────────────────────────────────────────────────

const VAULT_PROJECTS = path.join(
  process.env.HOME,
  'Library/Mobile Documents/iCloud~md~obsidian/Documents/Derek\'s Vault/Projects'
);

// Workout days: Mon=1, Wed=3, Fri=5
const WORKOUT_DAYS = new Set([1, 3, 5]);

// Weekday = Mon–Fri (0=Sun, 6=Sat)
const isWeekday = (dow) => dow >= 1 && dow <= 5;

// ─── Routines ─────────────────────────────────────────────────────────────────
// time is LOCAL (EDT display). workoutDaysOnly / weekdayOnly filter by day type.

const ROUTINES = [
  { title: 'Morning pills & supplements',         time: '06:00', emoji: '💊' },
  { title: 'Shower, skincare, brush & floss',     time: '06:30', emoji: '🚿' },
  { title: 'Empty dishwasher · breakfast w/ kids',time: '07:00', emoji: '🍳' },
  { title: 'Erin leaves (school + gym)',           time: '08:50', emoji: '👋', weekdayOnly: true },
  { title: 'Workout @ ASAP Fitness',               time: '09:00', emoji: '💪', workoutDaysOnly: true },
  { title: 'Vitality Bowl run',                    time: '10:00', emoji: '🥣', workoutDaysOnly: true },
  { title: 'Start work',                           time: '11:00', emoji: '💼', weekdayOnly: true },
  { title: 'Jack school pickup',                   time: '15:00', emoji: '🚗', weekdayOnly: true },
  { title: 'Wrap work',                            time: '17:30', emoji: '✋', weekdayOnly: true },
  { title: 'Dinner + family time',                 time: '18:00', emoji: '🍽️' },
  { title: 'Cian to bed',                          time: '19:00', emoji: '😴' },
  { title: 'Jack to bed',                          time: '20:30', emoji: '🛏️' },
  { title: 'PM meds, brush, floss, skincare',      time: '21:00', emoji: '🧴' },
  { title: 'Wind down (reading, no screens)',       time: '21:30', emoji: '📖' },
  { title: 'Lights out',                           time: '22:00', emoji: '💤' },
];

// ─── Interest keywords for free-block scoring ─────────────────────────────────

const INTEREST_HUBS = {
  '[[✱ Woodworking]]': { label: 'Woodworking', score: 10 },
  '[[✱ Firearms]]':    { label: 'Firearms / Dry Fire', score: 10 },
  '[[✱ Fitness]]':     { label: 'Fitness', score: 9 },
  '[[✱ House]]':       { label: 'Home project', score: 8 },
  '[[✱ Business]]':    { label: 'Business', score: 7 },
  '[[✱ Finance]]':     { label: 'Finance', score: 6 },
  '[[✱ Vehicle]]':     { label: 'Truck / Vehicle', score: 5 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayName(date) {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()];
}

function formatLocalTime(isoStr) {
  // Parse ISO, return local HH:mm
  const d = new Date(isoStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isUnscheduled(isoStr) {
  // Apple Reminders encodes "date only" as T04:00:00Z (= midnight EDT)
  // or midnight in local time → local hours === 0 and minutes === 0
  const d = new Date(isoStr);
  return d.getHours() === 0 && d.getMinutes() === 0;
}

// ─── Reminders ────────────────────────────────────────────────────────────────

function fetchTomorrowReminders() {
  try {
    const raw = execSync('remindctl tomorrow --json', { encoding: 'utf8', timeout: 15000 });
    return JSON.parse(raw);
  } catch (e) {
    console.error('⚠️  remindctl error:', e.message);
    return [];
  }
}

// ─── Obsidian Projects ────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const fm = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return fm;
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) fm[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  // tags: parse array notation [project, active] or inline
  const tagsLine = match[1].match(/^tags:\s*(.+)$/m);
  if (tagsLine) {
    const raw = tagsLine[1];
    fm.tagsArr = raw
      .replace(/[\[\]]/g, '')
      .split(',')
      .map(t => t.trim().replace(/^#/, ''));
  } else {
    fm.tagsArr = [];
  }
  return fm;
}

function parseNextAction(content) {
  // Look for > [!todo] Next Action\n> <text>
  const m = content.match(/>\s*\[!todo\]\s*Next Action\s*\n>\s*(.+)/i);
  return m ? m[1].trim() : null;
}

function loadActiveProjects() {
  if (!fs.existsSync(VAULT_PROJECTS)) return [];

  const files = fs.readdirSync(VAULT_PROJECTS).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  const projects = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(VAULT_PROJECTS, file), 'utf8');
      const fm = parseFrontmatter(content);

      if (fm.status !== 'active') continue;

      const title = file.replace(/\.md$/, '');
      const nextAction = parseNextAction(content);
      const hub = fm.hub || '';

      // Score by interest alignment
      let score = 0;
      let category = 'General';
      for (const [key, val] of Object.entries(INTEREST_HUBS)) {
        if (hub.includes(key.replace(/\[\[|\]\]/g, '').replace('✱ ', ''))) {
          score = val.score;
          category = val.label;
          break;
        }
      }
      // Also match hub directly
      for (const [key, val] of Object.entries(INTEREST_HUBS)) {
        if (hub === key) {
          score = val.score;
          category = val.label;
          break;
        }
      }

      projects.push({ title, status: fm.status, hub, category, score, nextAction, tags: fm.tagsArr });
    } catch (_) { /* skip unreadable files */ }
  }

  // Sort by score desc
  return projects.sort((a, b) => b.score - a.score);
}

// ─── Free Block Suggestions ───────────────────────────────────────────────────

function buildSuggestions(activeProjects, unscheduledTasks, isWorkout, dowNum) {
  const suggestions = [];
  const used = new Set();

  // On workout days, the block is already occupied 9-10; shrink to 10-11 or skip project work
  const blockLabel = isWorkout ? '10–11 AM' : '9–11 AM';

  // 1. Top active projects (by interest score)
  for (const p of activeProjects) {
    if (suggestions.length >= 2) break;
    let nextAction = p.nextAction || '';
    if (nextAction.length > 60) nextAction = nextAction.slice(0, 57) + '…';
    const action = nextAction ? `: ${nextAction}` : '';
    suggestions.push({
      text: `*${p.title}*${action}`,
      tag: p.category,
    });
    used.add(p.title);
  }

  // 2. Fill with unscheduled tasks that sound doable in 1-2 hrs
  for (const t of unscheduledTasks) {
    if (suggestions.length >= 3) break;
    if (used.has(t.title)) continue;
    suggestions.push({
      text: `*${t.title}*`,
      tag: 'Task',
    });
    used.add(t.title);
  }

  // 3. If still empty, offer a generic fitness/rucking suggestion
  if (suggestions.length === 0) {
    if (!isWorkout) {
      suggestions.push({ text: '*Ruck walk or mobility work*', tag: 'Fitness' });
    }
    suggestions.push({ text: '*Garage time — shop organization or project planning*', tag: 'Woodworking' });
    suggestions.push({ text: '*Dry fire practice (MantisX session)*', tag: 'Firearms' });
  }

  return { blockLabel, suggestions };
}

// ─── Telegram Message Builder ─────────────────────────────────────────────────

function buildMessage(date, dow, dowNum, reminders, activeProjects) {
  const isWorkout = WORKOUT_DAYS.has(dowNum);
  const weekday   = isWeekday(dowNum);

  // Separate scheduled vs unscheduled reminders
  // Exclude "Routines" list — already represented in hardcoded routines section
  const inbox = reminders.filter(r => r.listName !== 'Routines');
  const scheduled   = inbox.filter(r => !isUnscheduled(r.dueDate));
  const unscheduled = inbox.filter(r =>  isUnscheduled(r.dueDate));

  // Filter routines for the day
  const routines = ROUTINES.filter(r => {
    if (r.workoutDaysOnly && !isWorkout) return false;
    if (r.weekdayOnly && !weekday) return false;
    return true;
  });

  const { blockLabel, suggestions } = buildSuggestions(
    activeProjects,
    unscheduled,
    isWorkout,
    dowNum
  );

  const lines = [];

  // Header
  lines.push(`📅 *Tomorrow — ${dow}, ${formatDate(date)}*`);
  lines.push('');

  // Routines
  lines.push('*📋 Routines*');
  for (const r of routines) {
    lines.push(`  ${r.emoji} ${r.time} — ${r.title}`);
  }

  // Scheduled tasks
  if (scheduled.length > 0) {
    lines.push('');
    lines.push('*✅ Scheduled Tasks*');
    for (const r of scheduled.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))) {
      const t = formatLocalTime(r.dueDate);
      lines.push(`  🔹 ${t} — ${r.title}`);
    }
  }

  // Free block (unscheduled tasks folded in)
  lines.push('');
  lines.push(`*🕘 FREE BLOCK (${blockLabel})*`);
  if (isWorkout && blockLabel === '10–11 AM') {
    lines.push('  _Workout 9–10 AM · 1 free hour after_');
    lines.push('');
  }
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    lines.push(`  ${i + 1}. ${s.text} — ${s.tag}`);
  }

  // Footer
  lines.push('');
  lines.push('─────────────────');
  lines.push('React ✅ to approve, or reply with changes.');

  return lines.join('\n');
}

function formatDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const tDate   = tomorrow();
  const dow     = dayName(tDate);
  const dowNum  = tDate.getDay();
  const dateStr = fmt(tDate);

  console.error(`🗓  Building preview for ${dow}, ${dateStr}…`);

  const reminders      = fetchTomorrowReminders();
  const activeProjects = loadActiveProjects();

  console.error(`📋 Reminders: ${reminders.length} (${reminders.filter(r => !isUnscheduled(r.dueDate)).length} scheduled, ${reminders.filter(r => isUnscheduled(r.dueDate)).length} unscheduled)`);
  console.error(`📁 Active projects: ${activeProjects.length}`);
  console.error(`   Top projects: ${activeProjects.slice(0, 3).map(p => p.title).join(', ')}`);

  const message = buildMessage(tDate, dow, dowNum, reminders, activeProjects);

  // Print message to stdout (for piping / integration)
  console.log(message);
}

main();
