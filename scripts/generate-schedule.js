#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Workout days: Monday (1), Wednesday (3), Friday (5)
const WORKOUT_DAYS = new Set([1, 3, 5]);

// Hardcoded routines (always present)
const HARDCODED_ROUTINES = [
  { 
    id: "r1", 
    type: "routine", 
    title: "Wake up · Meds & supplements", 
    time: "06:00", 
    icon: "🌅",
    details: [
      "Lexapro (escitalopram) — antidepressant/anxiety",
      "Wellbutrin XL (bupropion) — antidepressant/focus",
      "With breakfast"
    ]
  },
  { 
    id: "r2", 
    type: "routine", 
    title: "Shower, skincare, brush & floss", 
    time: "06:30", 
    icon: "🚿",
    details: [
      "Cleanse: The Ordinary Glucoside Foaming Cleanser",
      "Hydrate: The Ordinary Hyaluronic Acid 2% + B5",
      "Sunscreen: The Ordinary UV Filters SPF 45 (most important!)",
      "Brush: Quip Ultra + Colgate Total (2 min)",
      "Floss: Oral-B Glide Ultra Deep Clean picks",
      "Rinse: Crest Deep Cleanse Mouthwash"
    ]
  },
  { id: "r3", type: "routine", title: "Empty dishwasher & breakfast with kids", time: "07:00", icon: "🍳" },
  { id: "r4", type: "routine", title: "Erin leaves (Jack to school, Cian to gym)", time: "08:50", icon: "👋", weekdayOnly: true },
  { id: "r5", type: "event", title: "Workout @ ASAP Fitness", time: "09:00", duration: 60, workoutDaysOnly: true },
  { id: "r6", type: "event", title: "Vitality Bowl — Warrior Açaí", time: "10:00", duration: 15, workoutDaysOnly: true },
  { id: "r7", type: "routine", title: "Start work", time: "11:00", icon: "💼", weekdayOnly: true },
  { id: "r8", type: "routine", title: "Jack school pickup", time: "15:00", icon: "🚗", weekdayOnly: true },
  { id: "r9", type: "routine", title: "Wrap work", time: "17:30", icon: "✋", weekdayOnly: true },
  { id: "r10", type: "routine", title: "Dinner + family time", time: "18:00", icon: "🍽️" },
  { id: "r11", type: "routine", title: "Cian to bed", time: "19:00", icon: "😴" },
  { id: "r12", type: "routine", title: "Jack to bed", time: "20:30", icon: "🛏️" },
  { 
    id: "r13", 
    type: "routine", 
    title: "Evening meds, skincare, brush & floss", 
    time: "21:00", 
    icon: "🧴",
    details: [
      "Meds: Crestor (rosuvastatin) with dinner",
      "Ritual supplements: Multivitamin, Probiotic, Melatonin",
      "Cleanse: The Ordinary Glucoside Foaming Cleanser",
      "Active: The Ordinary Retinol 0.2% (pea-sized, 2–3x/week initially)",
      "Moisturize: The Ordinary Natural Moisturizing Factors + HA",
      "Brush: Quip Ultra + Colgate Total (2 min)",
      "Floss: Oral-B Glide Ultra Deep Clean picks",
      "Rinse: Crest Deep Cleanse Mouthwash"
    ]
  },
  { id: "r14", type: "routine", title: "Wind down (reading, no screens)", time: "21:30", icon: "📖" },
  { id: "r15", type: "routine", title: "Lights out", time: "22:00", icon: "💤" }
];

// Map time strings (HH:mm) to minutes for sorting
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Get date string for tomorrow
function getTomorrowStr() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Get day of week (0=Sun, 1=Mon, ..., 6=Sat)
function getDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getDay();
}

function getDayName(dayIndex) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
}

// Fetch reminders for tomorrow via remindctl
function getRemindersForTomorrow() {
  try {
    const output = execSync('remindctl tomorrow --json', { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (err) {
    console.error('Error fetching reminders:', err.message);
    return [];
  }
}

// Convert remindctl reminder to schedule item
function reminderToTask(reminder) {
  // Parse ISO 8601 date in UTC and convert to local time
  const dueTime = new Date(reminder.dueDate);
  // getHours/getMinutes on a Date object already returns local time
  const h = String(dueTime.getHours()).padStart(2, '0');
  const m = String(dueTime.getMinutes()).padStart(2, '0');
  const time = `${h}:${m}`;

  const item = {
    id: `task-${reminder.id}`,
    type: 'task',
    title: reminder.title,
    time: time,
    duration: 15 // default duration
  };

  // Only add priority if it's not 'none'
  if (reminder.priority && reminder.priority !== 'none') {
    item.priority = reminder.priority;
  }

  return item;
}

// Main function
function generateSchedule() {
  const tomorrowStr = getTomorrowStr();
  const dayIndex = getDayOfWeek(tomorrowStr);
  const dayName = getDayName(dayIndex);
  const isWorkoutDay = WORKOUT_DAYS.has(dayIndex);

  // Get reminders and convert to tasks
  const reminders = getRemindersForTomorrow();
  const tasks = reminders.map(reminderToTask);

  // Start with hardcoded routines
  const allItems = [...HARDCODED_ROUTINES];

  // Add tasks from reminders
  allItems.push(...tasks);

  // Filter out workout-only and weekday-only items based on day of week
  const isWeekday = dayIndex >= 1 && dayIndex <= 5; // Mon-Fri (0=Sun, 6=Sat)
  const filteredItems = allItems.filter(item => {
    if (item.workoutDaysOnly && !isWorkoutDay) return false;
    if (item.weekdayOnly && !isWeekday) return false;
    return true;
  });

  // Deduplicate: remove tasks that match routine titles (case-insensitive substring match)
  const routineTitles = HARDCODED_ROUTINES.map(r => r.title.toLowerCase());
  const deduplicatedItems = filteredItems.filter(item => {
    if (item.type === 'task') {
      const taskTitleLower = item.title.toLowerCase();
      // Skip if task title is a substring of any routine title (or vice versa)
      const isDuplicate = routineTitles.some(routine =>
        routine.includes(taskTitleLower) || taskTitleLower.includes(routine)
      );
      return !isDuplicate;
    }
    return true; // Keep all routines
  });

  // Sort by time
  deduplicatedItems.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  // Build summary
  const deduplicatedTaskCount = deduplicatedItems.filter(i => i.type === 'task').length;
  const summaryParts = [];
  if (deduplicatedTaskCount > 0) {
    summaryParts.push(`${deduplicatedTaskCount} ${deduplicatedTaskCount === 1 ? 'task' : 'tasks'}`);
  }
  if (isWorkoutDay) {
    summaryParts.push('Workout day');
  }
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : 'No additional tasks';

  // Build schedule object
  const schedule = {
    date: tomorrowStr,
    updated: new Date().toISOString(),
    summary: summary,
    items: deduplicatedItems
  };

  // Write to file
  const schedulesDir = path.join(__dirname, '..', 'schedules');
  const todayJsonPath = path.join(schedulesDir, 'today.json');

  if (!fs.existsSync(schedulesDir)) {
    fs.mkdirSync(schedulesDir, { recursive: true });
  }

  fs.writeFileSync(todayJsonPath, JSON.stringify(schedule, null, 2), 'utf8');

  console.log(`✅ Schedule generated for ${tomorrowStr} (${dayName})`);
  console.log(`   Summary: ${summary}`);
  console.log(`   Items: ${deduplicatedItems.length}`);
  console.log(`   File: ${todayJsonPath}`);
}

generateSchedule();
