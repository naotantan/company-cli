# maestro — The platform for running AI skills properly

[日本語](./README.md) | **English** | [中文](./README.zh.md)

## What is maestro?

"We started using AI like Claude or Gemini at work, but when it crashes someone has to restart it manually, and before we know it the API bill has exploded…"

maestro is an open-source backend that solves exactly these problems.

What it does is simple: it automates the **start, monitor, stop, and cost management** of AI skills. Think of it as an **operations management tool for AI skills**.

---

## What problems does it solve?

| Common pain point | What maestro does |
|---|---|
| AI crashes go unnoticed | Health check every 30 seconds; auto-restart on failure (up to 3 times) |
| API bills balloon unexpectedly | Set a monthly budget cap; skills auto-stop the moment it's exceeded |
| No visibility into who ran what | All operations are logged with timestamps (audit-ready) |
| Task assignment is manual | Register a task and it's automatically assigned to an available skill |
| Session work gets lost | Auto-save session summaries via Stop hook |
| Want to integrate with Slack or GitHub | Configure with Webhooks — no code needed |

---

## Supported AI models

maestro supports multiple AI models through an **adapter** system. The following adapters are available in `packages/adapters/src/`:

| Adapter | Description |
|---|---|
| `claude-api` | Claude via Anthropic API |
| `claude-local` | Local Claude (e.g. Claude Code) |
| `codex-local` | OpenAI Codex locally |
| `gemini-local` | Google Gemini locally |
| `cursor` | Cursor editor integration |
| `opencode-local` | OpenCode locally |
| `openclaw-gateway` | Via OpenClaw gateway |
| `pi-local` | Pi locally |

Switch models from the Web dashboard — no code changes required.

---

## Architecture overview

maestro is a monorepo split into 7 packages.

```
maestro/
├── packages/
│   ├── api/          ← REST API server (Express.js) ★ main backend
│   │   └── src/
│   │       ├── engine/
│   │       │   ├── heartbeat-engine.ts   … health check every 30s
│   │       │   ├── crash-recovery.ts     … detect crash → auto-restart
│   │       │   └── budget-monitor.ts     … budget exceeded → auto-stop
│   │       ├── routes/                   … REST endpoints
│   │       ├── middleware/               … auth & request logging
│   │       └── server.ts                 … Express app init
│   ├── cli/          ← CLI tool (17 commands)
│   ├── ui/           ← Web dashboard (React + Vite)
│   ├── db/           ← Database schema & migrations (Drizzle ORM)
│   ├── adapters/     ← AI model adapters (8 types)
│   ├── shared/       ← Shared types & utilities
│   └── i18n/         ← Internationalization (Japanese, English, Chinese)
├── docker-compose.yml
└── package.json
```

---

## Dashboard (Mission Control)

The dashboard gives you a real-time view of your AI operations:

- **Metrics chips** — sessions, active jobs, and monthly cost at a glance
- **Session feed** — latest sessions in real time
- **Job panel** — status of running and completed jobs
- **Skill usage chart** — usage frequency by skill
- **Cost summary** — cost trends over time

---

## How the 3 core engines work

The heart of maestro lives in `packages/api/src/engine/`.

### 1. Heartbeat Engine (heartbeat-engine.ts)

**What it does:** Every 30 seconds, asks every enabled skill "are you alive?"

**Flow:**

1. Fetch all skills with `enabled: true` from the database
2. Run health checks via adapters (up to 3 in parallel)
3. If responsive → update `last_heartbeat_at`
4. If unresponsive → set `agent_runtime_state` to `crashed` (picked up by the crash recovery engine)
5. Also processes any pending skill-to-skill handoffs

### Note: Skill handoffs and chains

The heartbeat engine also handles passing work to the next skill when a task completes.

- **1-to-1 handoff**: Skill A finishes → passes output to Skill B to continue
- **Chain (A→B→C)**: Connect multiple skills in sequence to run as a pipeline

### 2. Crash Recovery Engine (crash-recovery.ts)

**What it does:** Every 60 seconds, finds crashed skills and automatically recovers them.

**Flow:**

1. Find entries with `status: crashed` in `agent_runtime_state`
2. If restart count < 3 → reset status to `idle` (re-executed on next heartbeat)
3. If restart count reaches 3 → disable and stop the skill (prevents infinite loops)

### 3. Budget Monitor (budget-monitor.ts)

**What it does:** Every 60 seconds, checks the current month's cost for each tenant.

**Flow:**

1. Fetch all budget policies
2. Aggregate cumulative costs for the current month
3. If limit exceeded → auto-stop all skills for that company
4. Record the incident in `budget_incidents`

---

## Key Features

### Skill Management
- **One-click install** from GitHub repositories
- **Auto-sync** with everything-claude-code and other major skill sets
- Usage examples auto-extracted from `SKILL.md` and shown in the dashboard
- Category classification, favorites, **usage count & last-used date tracking**
- Enable / disable / uninstall

### Session & Memory
- **Auto-save** Claude Code session work logs (via Stop hook)
- **Long-term memory store** across sessions (MCP memory package)
- Structured session summary storage (headline / tasks / decisions / changed files)

### Security & Multi-tenancy
- Complete data isolation by **company_id**
- Bearer token authentication (3 key types: user / board / company)
- SSRF protection on Webhook URLs (DNS resolution + private IP block)
- AES-256-GCM encryption for stored credentials
- `X-Request-ID` on all requests, rate limiting, Helmet.js CSP

### Other
- **Artifacts management** — report / image / document / code, etc.
- **Playbooks & recipes** — standardize repetitive tasks
- **Notification system** — activity-based alerts
- **Full-text search** API
- **Webhooks** — send events to external services
- **i18n** — Japanese, English, Chinese

> **Project & Issue management via Plane**
> maestro focuses on daily AI agent operations. For development tasks and issue tracking, we recommend integrating with external tools like [Plane](https://plane.so).

---

## API endpoints

The REST API uses Bearer token authentication.

| Endpoint | Role |
|---|---|
| `/health` | Health check (no auth required) |
| `/api/auth` | Login & token issuance |
| `/api/agents` | Skill CRUD |
| `/api/plugins` | Plugin / skill management |
| `/api/plugins/track-usage` | Record skill usage |
| `/api/session-summaries` | Session records |
| `/api/memories` | Long-term memory |
| `/api/artifacts` | Artifact management |
| `/api/costs` | Cost data |
| `/api/analytics` | Usage analytics |
| `/api/routines` | Recurring task management |
| `/api/settings` | Tenant settings |
| `/api/webhooks` | Webhook management |

---

## Setup (for first-time users)

### Method 1: Install script (recommended)

**Requirement: Docker only**

```bash
curl -fsSL https://raw.githubusercontent.com/naotantan/maestro/main/install.sh | bash
```

Automatically:

1. Clones maestro (into `~/maestro`)
2. Generates a `.env` file
3. Runs `docker compose up --build`

Then open `http://localhost:5173` in your browser.

---

### Method 2: Docker Compose (manual)

**Requirement: Docker only**

```bash
git clone https://github.com/naotantan/maestro.git
cd maestro
cp .env.example .env          # edit as needed
docker compose up -d --build
```

| Service | URL |
|---|---|
| Dashboard (UI) | http://localhost:5173 |
| API | http://localhost:3000 |

---

### Useful commands

```bash
# Stop
docker compose down

# Restart
docker compose up -d

# View logs
docker compose logs -f

# Update (pull latest code and rebuild)
git pull && docker compose up -d --build
```

---

### Local development (Node.js)

**Requirements: Node.js 20+, pnpm 9+, Docker**

```bash
git clone https://github.com/naotantan/maestro.git
cd maestro
pnpm install
cp .env.example .env
docker compose up -d postgres   # start DB only
pnpm db:migrate
pnpm dev                        # start API + UI together
```

---

## Claude Code integration

### Stop hook (session recording)

```json
{
  "hooks": {
    "Stop": [{
      "command": "node ~/.maestro/hooks/session-end.js"
    }]
  }
}
```

Automatically sends session work to `POST /api/session-summaries` on session end.

### Skill usage tracking (PostToolUse hook)

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Skill",
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/scripts/hooks/track-skill-usage.js"
      }]
    }]
  }
}
```

Automatically records usage count and last-used date every time a Skill tool runs.

### MCP memory server

```bash
claude mcp add maestro-memory --transport http http://localhost:3001/mcp
```

Read and write long-term memory across Claude Code sessions.

---

## Plane integration

Enter your Plane connection details in the settings screen to link maestro with an external Plane project. This enables a hybrid workflow: daily AI agent logs in maestro + development task management in Plane.

---

## Skill updates

Click **"Update Skills"** in the Web dashboard to:

1. `git pull` the everything-claude-code repository
2. Sync all skills under `~/.claude/skills/` to the DB
3. Auto-extract usage examples from each `SKILL.md`

---

## Security

| Measure | Implementation |
|---|---|
| HTTP header protection | Helmet.js (including CSP) |
| Rate limiting | Global: 100 req / 15 min / Auth: 10 req / 15 min |
| Authentication | Bearer token |
| Tenant isolation | `company_id` filter on every query |
| Encryption | AES-256-GCM (stored credentials) |
| SSRF protection | DNS resolution + private IP check on Webhook URLs |
| SQL injection protection | Parameterized queries via Drizzle ORM |
| Request tracing | `X-Request-ID` on every request |

---

## Tech stack

| Category | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| API server | Express.js |
| Database | PostgreSQL 17 |
| ORM | Drizzle ORM |
| Frontend | React 18 + Vite + Tailwind CSS |
| Package manager | pnpm (monorepo) |
| Testing | Vitest |
| Container | Docker / Docker Compose |
| License | MIT |

---

## Contributing

1. Branch off `main` into a feature branch
2. Implement your changes
3. Run `pnpm test` to confirm tests pass
4. Run `pnpm typecheck` to confirm type checks pass
5. Follow Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)
6. Open a pull request

Package build order: `shared → db → i18n → adapters → api → cli → ui`

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
