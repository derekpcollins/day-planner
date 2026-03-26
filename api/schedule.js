const fs = require('fs');
const path = require('path');

// Workout days: Monday (1), Wednesday (3), Friday (5)
const WORKOUT_DAYS = new Set([1, 3, 5]);

function getDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
}

function getDayName(dayIndex) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
}

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const schedulesDir = path.resolve(__dirname, '..', 'schedules');
    const todayJsonPath = path.join(schedulesDir, 'today.json');

    if (!fs.existsSync(todayJsonPath)) {
      return res.status(404).json({ error: 'No schedule found for today. Colossus will generate one.' });
    }

    const raw = fs.readFileSync(todayJsonPath, 'utf8');
    const data = JSON.parse(raw);

    // Determine the target date: use query param if provided, else data.date, else today
    const targetDate = req.query.date || data.date || getTodayStr();
    const dayIndex = getDayOfWeek(targetDate);
    const dayOfWeek = getDayName(dayIndex);
    const isWorkoutDay = WORKOUT_DAYS.has(dayIndex);

    // Filter out workout-only items on non-workout days
    const items = (data.items || []).filter(item => {
      if (item.workoutDaysOnly && !isWorkoutDay) return false;
      return true;
    });

    // Build summary if not provided or if we need to recalculate
    let summary = data.summary;
    if (!summary) {
      const taskCount = items.filter(i => i.type === 'task').length;
      const parts = [];
      if (taskCount > 0) parts.push(`${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`);
      if (isWorkoutDay) parts.push('Workout day');
      summary = parts.join(' · ') || 'No tasks today';
    }

    return res.status(200).json({
      date: targetDate,
      dayOfWeek,
      isWorkoutDay,
      summary,
      updated: data.updated || new Date().toISOString(),
      items,
    });
  } catch (err) {
    console.error('Schedule API error:', err);
    return res.status(500).json({ error: 'Failed to load schedule', detail: err.message });
  }
};
