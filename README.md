# Contest Monitor — Lomba Programming

Real-time monitoring system for programming contests that detects cheating (copy-paste, AI tools, plagiarism) across GitHub Codespaces environments.

## Architecture

```
Participant Codespace (VS Code Extension)
    | POST /api/events (batch, every 30s)
    v
Backend Server (:3000)  <--- GitHub API (cron, every 5min)
    |--- MongoDB (events, participants, typing patterns, github analysis)
    |--- Socket.io real-time push
    |--- Alert dispatch (Slack, Discord, Email)
    v
Admin Dashboard (:80 / :5173)
    React 18 + MUI + Recharts + React Query + Zustand
```

## Components

| Component | Folder | Description |
|---|---|---|
| VS Code Extension | `coding-contest-monitor/` | Monitors keystrokes, paste, focus, clipboard, file ops. Batches events to server every 30s |
| DevContainer | `.devcontainer/` | GitHub Codespaces config. Auto-installs extension, blocks AI tools, hardens settings |
| Backend Server | `contest-monitor-server/` | Express + MongoDB + Socket.io. Event scoring, GitHub commit analysis, Winnowing plagiarism detection |
| Admin Dashboard | `contest-dashboard/` | React SPA. Live participant monitoring, suspicion scores, event timeline, similarity reports |

## Quick Start (Docker)

```bash
# Clone and start all services
docker compose up --build

# Services:
#   MongoDB   → localhost:27017
#   Backend   → localhost:3000
#   Dashboard → localhost:80
```

Default admin credentials: `admin` / `contestadmin2024`

## Quick Start (Development)

```bash
# 1. Start MongoDB locally (or use Docker)
docker run -d -p 27017:27017 mongo:7

# 2. Backend
cd contest-monitor-server
cp .env.example .env   # edit as needed
npm install
npm run dev            # nodemon on :3000

# 3. Dashboard
cd contest-dashboard
npm install
npm run dev            # vite on :5173 (proxies /api to :3000)
```

## Environment Variables

See `contest-monitor-server/.env.example` for all configurable options:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — Secret for admin JWT tokens
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Dashboard login
- `GITHUB_TOKEN` — GitHub PAT for commit monitoring (optional)
- `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` — Alert webhooks (optional)
- `SMTP_*` — Email alert config (optional)

## Detection Capabilities

- **Copy-paste detection** — flags pastes >50 characters with suspicion scoring
- **Typing pattern analysis** — detects bot-like typing (<50ms intervals)
- **Focus tracking** — alerts when participant leaves editor >2 minutes
- **Clipboard monitoring** — SHA-256 hashed clipboard content tracking
- **File operation tracking** — create/delete/rename monitoring
- **GitHub commit analysis** — large commits, burst patterns, off-hours activity
- **Cross-repo plagiarism** — Winnowing algorithm (Jaccard similarity >80% flagged)

## Dashboard Pages

- **Dashboard** — live overview, top flagged participants, activity heatmap, event distribution
- **Participants** — searchable/sortable table, export CSV
- **Participant Detail** — event timeline, typing charts, GitHub commits, similarity matches (5 tabs)
- **Analytics** — suspicion distribution, activity breakdown, top participants by events
- **Alerts** — severity filtering, mark-as-reviewed, export

## Contest Setup

1. Deploy backend + dashboard (Docker or manual)
2. Create a GitHub Codespaces template repo with the `.devcontainer/` config
3. Place `coding-contest-monitor-1.0.0.vsix` in the expected path (see `devcontainer.json`)
4. Set `CONTEST_MONITOR_SERVER_URL` in devcontainer environment
5. Participants open the Codespace — extension auto-activates and starts reporting
6. Monitor via the admin dashboard at the configured URL
