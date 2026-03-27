# Day Planner

A clean, minimal dark-mode daily schedule app for Derek. Designed to show the day ahead at a glance—routines, tasks, free-block suggestions—all synced daily via automated workflow.

## What it does

- **Real-time schedule:** Shows today's date, time-of-day greeting, and a summary line
- **Vertical timeline:** 5am to 10pm with current hour highlighted and auto-scrolled
- **Item types:**
  - **Routines** (teal accent) — not checkable; tap to expand meds/skincare/details
  - **Tasks** (checkable) — state saved to localStorage (resets daily)
  - **Events** (blue left border) — calendar-style items, not checkable
- **Smart filtering:** Workout-only items hidden on non-workout days (Tue/Thu/Sat/Sun)
- **Expandable details:** Morning/evening meds, skincare routine steps, and other multi-step items expand when tapped
- **Unscheduled tasks:** Appear at the top in a floating "Today's Tasks" section
- **Persistent state:** Task completion state saved locally and resets each day

## How it works

### The Daily Workflow

**9 PM (Evening):**
1. Colossus runs `preview-schedule.js`
2. Reads tomorrow's Reminders (Apple Reminders app)
3. Pulls active projects from Obsidian vault
4. Sends a preview to Derek's Telegram with:
   - Tomorrow's routines (morning, evening, meals, etc.)
   - Free block suggestions (9–11 AM)
   - Unscheduled tasks to consider
5. Derek approves with ✅ or replies with changes

**Midnight:**
1. Colossus runs `generate-schedule.js`
2. Reads tomorrow's Reminders + hardcoded routines
3. Deduplicates tasks that match routine titles
4. Generates `schedules/today.json`
5. Deploys to Vercel via `vercel deploy --prod`

**6 AM (Morning):**
1. Derek opens the app on his phone
2. Sees today's full schedule with all confirmed tasks
3. Taps routines to expand meds/skincare details
4. Checks off tasks as he completes them (state persists locally)

### Data Sources

**1. Apple Reminders**
- Read via `remindctl` CLI
- Pulls "Today" and tomorrow's tasks
- Unscheduled tasks (no time set) become free-block suggestions

**2. Hardcoded Routines**
- Morning: wake up, shower, breakfast, Erin/kids leave
- Work block: start work, school pickup, wrap work
- Evening: dinner, kids bedtime, meds, skincare, wind down, lights out
- Workout days (Mon/Wed/Fri): adds workout + post-workout meal
- Expandable details: meds, skincare products, oral care steps

**3. Obsidian Projects**
- Reads `/Users/colossus/Library/Mobile Documents/iCloud~md~obsidian/Documents/Derek's Vault/Projects/`
- Filters for `status: active` projects
- Scores by interest alignment (Firearms/Woodworking/Fitness rank highest)
- Suggests top 2–3 for tomorrow's free block

### Key Features

**Deduplication:**
- Tasks matching routine titles (substring match) are automatically filtered
- Example: "Empty dishwasher" reminder deduped with "Empty dishwasher & breakfast with kids" routine

**Expandable Details:**
- Tap any routine with a `details` field to expand
- Currently included:
  - **Morning meds:** Lexapro, Wellbutrin (with timing)
  - **Morning skincare:** The Ordinary products (cleanser, hydration, SPF 45, etc.) + oral care (brush, floss, rinse)
  - **Evening meds & skincare:** Crestor, Ritual supplements (multivitamin, probiotic, melatonin), retinol, moisturizer, oral care

**Workout Days:**
- Automatically hides/shows workout-only items
- Workout days: Monday, Wednesday, Friday
- Shows: Workout @ ASAP Fitness (9–10 AM) + Vitality Bowl (10 AM)

**Task State:**
- Checkbox state saved to localStorage
- Resets daily (fresh start each morning)

## Architecture

```
index.html           — Frontend (vanilla JS, no framework)
api/schedule.js      — Vercel serverless function (GET /api/schedule)
schedules/today.json — Today's schedule data (updated nightly via cron)

scripts/
├── generate-schedule.js      — Main: reads Reminders + routines → JSON
├── preview-schedule.js       — 9 PM: previews tomorrow's plan
├── cron-send-preview.js      — Wrapper for 9 PM cron job
└── cron-update.js            — Wrapper for midnight cron job
```

### API

**`GET /api/schedule`**

Optional query param: `?date=YYYY-MM-DD` (defaults to today)

Response:
```json
{
  "date": "2026-03-28",
  "dayOfWeek": "Saturday",
  "isWorkoutDay": false,
  "summary": "3 tasks",
  "updated": "2026-03-28T00:00:00Z",
  "items": [...]
}
```

**Item fields:**
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique identifier |
| `type` | `routine` \| `task` \| `event` | Determines rendering |
| `title` | string | Display text |
| `time` | `HH:mm` | 24-hour format (local time) |
| `duration` | number | Minutes (optional) |
| `icon` | emoji | Shows in routine headers |
| `details` | string[] | Expandable list (routines only) |
| `priority` | `high` | Amber accent for tasks |
| `workoutDaysOnly` | boolean | Hidden on non-workout days |

### schedules/today.json format

```json
{
  "date": "2026-03-28",
  "updated": "2026-03-28T00:00:00Z",
  "summary": "3 tasks · Workout day",
  "items": [
    {
      "id": "r1",
      "type": "routine",
      "title": "Wake up · Meds & supplements",
      "time": "06:00",
      "icon": "🌅",
      "details": [
        "Lexapro (escitalopram) — antidepressant/anxiety",
        "Wellbutrin XL (bupropion) — antidepressant/focus",
        "With breakfast"
      ]
    },
    {
      "id": "task-123",
      "type": "task",
      "title": "Review Roofing proposal",
      "time": "10:00",
      "duration": 30,
      "priority": "high"
    }
  ]
}
```

## Run locally

No build step needed. Use the Vercel CLI for full local API support:

```bash
npm i -g vercel
cd day-planner
vercel dev
# Open http://localhost:3000
```

Or with Python (static only — API won't work):
```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

⚠️ **Don't open `index.html` directly via `file://`** — the `fetch()` call will fail due to CORS.

## Update the schedule manually

To manually update the schedule (rare; usually auto-updated via cron):

1. Edit `schedules/today.json`
2. Push to GitHub → Vercel auto-deploys

Or run the script directly:
```bash
node scripts/generate-schedule.js
vercel deploy --prod
```

## Cron Jobs

Two automated cron jobs run on the main session (America/New_York timezone):

### 9 PM: Preview Generation
- **Cron:** `0 21 * * *`
- **Event:** `day-planner-preview` (system event)
- **Action:** Generates tomorrow's schedule preview, sends to Telegram
- **User action:** Derek approves/adjusts in Telegram

### Midnight: Schedule Update & Deploy
- **Cron:** `0 0 * * *`
- **Event:** `day-planner-update` (system event)
- **Action:** Generates `schedules/today.json`, deploys to Vercel
- **Result:** App updated by 6 AM

## Deploy to Vercel

```bash
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard — it'll auto-deploy on every push.

## Tech Stack

- **Frontend:** Vanilla JavaScript (no framework)
- **API:** Node.js + Vercel serverless functions
- **Data:** Static JSON file + Apple Reminders CLI
- **Automation:** OpenClaw cron jobs + system events
- **Hosting:** Vercel

## Development

### Adding new routines

Edit `scripts/generate-schedule.js` → `HARDCODED_ROUTINES` array:

```javascript
{
  id: "r99",
  type: "routine",
  title: "My new routine",
  time: "14:00",
  icon: "⏰",
  details: ["Step 1", "Step 2"] // optional
}
```

Run the script to test:
```bash
node scripts/generate-schedule.js
```

### Adding expandable details

Just add a `details` array to any routine item:

```javascript
{
  id: "r1",
  type: "routine",
  title: "Morning routine",
  time: "06:00",
  icon: "🌅",
  details: [
    "Take med 1",
    "Take med 2",
    "Apply sunscreen"
  ]
}
```

The frontend automatically renders expandable sections for items with `details`.

### Debugging

Check cron job runs:
```bash
openclaw cron runs day-planner-preview
openclaw cron runs day-planner-update
```

Check logs:
```bash
tail -f /tmp/day-planner-preview.log
tail -f /tmp/day-planner-update.log
```

Run a script manually:
```bash
node scripts/preview-schedule.js
node scripts/generate-schedule.js
```

## Known Limitations

- **Calendar integration:** Currently skipped (future: add Derek/Family iCloud calendars)
- **Time parsing:** Assumes reminders are in EDT; adjust for other timezones
- **Offline:** Requires internet for Vercel deployment; local mode works offline

---

*Built with Colossus (AI) — Derek's personal assistant*
