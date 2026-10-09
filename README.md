# 🏒 Hicks Hockey Pool (HHP)

A full-featured NHL hockey pool app for the Hicks family —
weekly picks, a suicide pool, standings, payments tracking, and automated emails.

---

## Tech Stack

| Layer       | Technology                                  |
|-------------|----------------------------------------------|
| Frontend    | Next.js 16 (App Router) + React 19            |
| Styling     | Tailwind CSS 4 + Radix UI                     |
| Auth        | NextAuth v5 (email/password, invite-only)     |
| Database    | PostgreSQL + Prisma ORM 7 (config in `prisma.config.ts`) |
| Email       | Resend                                        |
| NHL Data    | Unofficial NHL API (api-web.nhle.com)         |
| Scheduling  | node-cron (separate container)                |
| Hosting     | Docker on Synology DS1621+                    |
| Domain      | hhp.kevinhamilton.ca (GoDaddy)                |

---

## Local Development Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/hicks-hockey-pool.git
cd hicks-hockey-pool
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 4. Start PostgreSQL (via Docker)
```bash
docker compose up postgres -d
```

### 5. Run database migrations
```bash
npm run db:migrate
```

### 6. Seed the database (creates admin user + initial settings)
```bash
npm run db:seed
```

### 7. Start the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Run `npm run lint` (ESLint) before committing — Next 16 no longer lints during `next build` (it still type-checks).

### Tests

```bash
npm test                  # everything
npm run test:unit         # fast, no database (NHL parsing, dates, rendering)
npm run test:integration  # real Postgres — needs Docker running
npm run test:watch        # unit tests, re-run on save
```

Integration tests start their own throwaway Postgres container (`hhp_vitest_pg`, port 55439) and remove it afterwards. They never read `.env` or `DATABASE_URL`, and refuse to run against anything that isn't a local database with "test" in its name. The NHL API is replaced by recorded responses in `tests/fixtures/nhl`.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check, both test suites and the Docker builds on every push.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable               | Description                                              |
|------------------------|-----------------------------------------------------------|
| `DATABASE_URL`         | PostgreSQL connection string                              |
| `NEXTAUTH_SECRET`      | Random secret (run `openssl rand -base64 32`)              |
| `NEXTAUTH_URL`         | Your app URL                                              |
| `RESEND_API_KEY`       | From the Resend dashboard (emails log to console if unset) |
| `EMAIL_FROM`           | Sender email address                                      |
| `EMAIL_FROM_NAME`      | Sender display name                                       |
| `NEXT_PUBLIC_APP_URL`  | Public app URL (used in emails/links)                      |
| `NEXT_PUBLIC_APP_NAME` | Public app name                                           |
| `TZ`                   | Timezone for scheduled tasks (`America/Toronto`)           |
| `NHL_API_BASE_URL`     | NHL API base URL (no key required)                         |
| `NHL_STATS_API_URL`    | NHL stats API base URL (no key required)                   |

---

## Synology Deployment

Quick start:
```bash
# On your Synology (via SSH)
git clone https://github.com/YOUR_USERNAME/hicks-hockey-pool.git
cd hicks-hockey-pool
cp .env.example .env
# Edit .env with production values
docker compose up -d
```

### Deploying an update

Images are built by GitHub Actions, not on the Synology. Every push to `main`
runs CI; when everything passes, the **Publish images** job pushes
`ghcr.io/kevham78/hhp-app` and `hhp-cron` (tagged `latest` and the commit sha).
Wait for the green check on GitHub, then on the Synology:

```bash
git pull                 # picks up docker-compose.yml changes
docker compose pull      # download the new images (~1-2 min)
docker compose up -d     # restart; the app runs any new migrations on startup
docker logs hhp_app | head -20
```

Roll back to an earlier build: set `HHP_TAG=<full commit sha>` in `.env`, then
`docker compose pull && docker compose up -d` (remove the line to go back to `latest`).
Fallback if GitHub is unavailable: `docker compose up -d --build` builds on the Synology (slow).

Containers read `.env` at runtime (`env_file` in `docker-compose.yml`); it is never
copied into an image. `NEXT_PUBLIC_APP_URL` is baked in at build time
(`ARG` in the `Dockerfile`, default `https://hhp.kevinhamilton.ca`).

`docker-compose.yml` runs three services:
- **postgres** — PostgreSQL 16
- **app** — the Next.js app (standalone build, runs `prisma migrate deploy` on start)
- **cron** — a separate lightweight container (`Dockerfile.cron`) running the scheduled jobs in `src/lib/cron`

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, register pages
│   ├── (dashboard)/     # Main app pages: picks, results, standings, payments, profile, admin
│   ├── api/             # API routes (auth, picks, standings, stats, payments, profile, admin)
│   └── layout.tsx       # Root layout
├── components/
│   ├── ui/              # Base UI components (Radix-based)
│   ├── picks/           # Weekly picks components
│   ├── stats/           # Team stats side panel
│   ├── standings/       # Standings components
│   ├── results/         # Weekly/monthly results components
│   ├── payments/        # Payment tracking components
│   ├── profile/         # User profile components
│   ├── admin/           # Commissioner tools
│   └── layout/          # Nav, header, sidebar
├── lib/
│   ├── db/              # Prisma client
│   ├── api/             # NHL API client
│   ├── email/           # Resend client + email templates
│   └── cron/            # Scheduler + auto-pick job
├── types/               # TypeScript types
└── auth.ts              # NextAuth config (Credentials provider, invite-only registration)

prisma/
├── schema.prisma        # Data model (users, seasons, weeks, games, picks, suicide pool, payments, stats, etc.)
├── migrations/          # Prisma migrations
└── seed.mjs             # Seed script
```

---

## Weekly Schedule (Eastern time)

| Time               | Event                                                     |
|--------------------|-------------------------------------------------------------|
| Thursday 3pm       | First reminder email (picks not submitted)                  |
| Friday 8am         | Second reminder email                                       |
| Friday 2pm         | Picks locked, auto-pick fires, reveal email                 |
| Saturday / Sunday  | Games played                                                 |
| Monday 9am         | Nudge email to the commissioner to confirm results           |
| Monday 11am        | Results auto-approved if the commissioner hasn't confirmed yet |

All five times are configurable per-pool from Settings → Email Schedule.
Scheduled jobs live in `src/lib/cron` and run only in the dedicated
`cron` container — the app container no longer starts its own copy.

My Picks stays locked (view-only) on the current week's picks until
results are confirmed — either manually by the commissioner or
automatically at the Monday deadline above — at which point it opens
for the next week's picks.

---

## Founding Brothers

Founded by the three Hicks brothers. Est. 2025. 🏒
