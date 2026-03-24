# Day Planner

A clean, minimal dark-mode daily schedule app for Derek. Opens with a morning briefing — time blocks, tasks, and events — all pulled from a single JSON file.

## What it does

- Shows today's date, a time-of-day greeting, and a summary line
- Renders a vertical timeline from 5am to 10pm
- **Events** (calendar items) — blue left border, not checkable
- **Tasks** (reminders) — checkable, with state saved to localStorage (resets each day)
- High-priority tasks get an amber accent
- Unscheduled tasks appear at the top in a "Today's Tasks" section
- Reads from `public/schedule.json` — swap it out to update the day

## Run locally

No build step needed. Just serve it:

```bash
# Python (built-in):
cd day-planner
python3 -m http.server 8080
# Open http://localhost:8080
```

Or use the VS Code Live Server extension, `npx serve .`, or any static file server.

> ⚠️ Don't open `index.html` directly via `file://` — the `fetch()` call will fail due to CORS. Use a local server.

## Update the schedule

Edit `public/schedule.json` and push to GitHub — Vercel auto-deploys.

### schedule.json format

```json
{
  "date": "YYYY-MM-DD",
  "updated": "YYYY-MM-DDTHH:MM:SS",
  "summary": "3 tasks · 1 event",
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
    }
  ]
}
```

- `type`: `"event"` or `"task"`
- `time`: 24h format (`"09:00"`) — omit for unscheduled tasks
- `duration`: minutes (optional)
- `priority`: `"high"` for amber accent (tasks only)

## Deploy to Vercel

```bash
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard — it'll auto-deploy on every push.

---

*Built with AI*
