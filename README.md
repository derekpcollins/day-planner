# Day Planner

A clean, minimal dark-mode daily schedule app for Derek. Opens with a morning briefing — time blocks, tasks, and events — all pulled from a serverless API backed by a static JSON file.

## What it does

- Shows today's date, a time-of-day greeting, and a summary line
- Renders a vertical timeline from 5am to 10pm
- **Events** (calendar items) — blue left border, not checkable
- **Tasks** (reminders) — checkable, with state saved to localStorage (resets each day)
- High-priority tasks get an amber accent
- Unscheduled tasks appear at the top in a "Today's Tasks" section
- Current hour is highlighted in blue and auto-scrolled to on load
- Workout items (tagged `workoutDaysOnly`) only appear on Mon/Wed/Fri
- Fetches from `/api/schedule` — Colossus updates `schedules/today.json` nightly

## Architecture

```
index.html           — Frontend (vanilla JS, no framework)
api/schedule.js      — Vercel serverless function (GET /api/schedule)
schedules/today.json — Today's schedule data (managed by Colossus)
public/schedule.json — Legacy static file (no longer used)
```

### API

**`GET /api/schedule`**

Optional query param: `?date=YYYY-MM-DD` (defaults to `data.date` in today.json)

Response:
```json
{
  "date": "2026-03-26",
  "dayOfWeek": "Thursday",
  "isWorkoutDay": false,
  "summary": "2 tasks",
  "updated": "2026-03-26T07:00:00",
  "items": [...]
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
```

> ⚠️ Don't open `index.html` directly via `file://` — the `fetch()` call will fail due to CORS.

## Update the schedule

Colossus manages `schedules/today.json` automatically each morning. To manually update:

1. Edit `schedules/today.json`
2. Push to GitHub — Vercel auto-deploys

### schedules/today.json format

```json
{
  "date": "YYYY-MM-DD",
  "updated": "YYYY-MM-DDTHH:MM:SS",
  "summary": "3 tasks · Workout day",
  "items": [
    {
      "id": "unique-id",
      "type": "event",
      "title": "Meeting title",
      "time": "09:00",
      "duration": 60,
      "notes": ""
    },
    {
      "id": "unique-id-2",
      "type": "task",
      "title": "Task name",
      "time": "08:00",
      "duration": 15,
      "notes": "Optional notes",
      "priority": "high"
    },
    {
      "id": "workout",
      "type": "event",
      "title": "Workout @ ASAP Fitness",
      "time": "09:00",
      "duration": 60,
      "workoutDaysOnly": true
    }
  ]
}
```

### Field reference

| Field | Values | Notes |
|---|---|---|
| `type` | `event`, `task`, `routine` | Controls rendering style |
| `time` | `"09:00"` (24h) | Omit for unscheduled tasks |
| `duration` | minutes | Optional |
| `priority` | `"high"` | Amber accent (tasks only) |
| `workoutDaysOnly` | `true` | Hidden on Tue/Thu/Sat/Sun |
| `icon` | emoji string | Shown on routine items |
| `details` | `["step 1", "step 2"]` | Expandable list (routines only) |

### Workout days

The API automatically filters items with `workoutDaysOnly: true` on non-workout days.

Workout days: **Monday, Wednesday, Friday**
Non-workout days: Tuesday, Thursday, Saturday, Sunday

## Deploy to Vercel

```bash
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard — it'll auto-deploy on every push.

---

*Built with Colossus (AI)*
