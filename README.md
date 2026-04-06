# 🏒 Hicks Hockey Pool (HHP)

A full-featured NHL hockey pool app for the Hicks family —
weekly picks, suicide pools, standings, and automated emails.

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | Next.js 14 (App Router) + React   |
| Styling     | Tailwind CSS + Radix UI           |
| Auth        | NextAuth v5 (Email + Google)      |
| Database    | PostgreSQL + Prisma ORM           |
| Email       | SendGrid                          |
| NHL Data    | Unofficial NHL API (free)         |
| Hosting     | Docker on Synology DS1621+        |
| Domain      | hhp.kevinhamilton.ca (GoDaddy)    |

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

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable              | Description                          |
|-----------------------|--------------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string         |
| `NEXTAUTH_SECRET`     | Random secret (run `openssl rand -base64 32`) |
| `NEXTAUTH_URL`        | Your app URL                         |
| `GOOGLE_CLIENT_ID`    | From Google Cloud Console            |
| `GOOGLE_CLIENT_SECRET`| From Google Cloud Console            |
| `SENDGRID_API_KEY`    | From SendGrid dashboard              |
| `EMAIL_FROM`          | Sender email address                 |

---

## Synology Deployment

See `/docs/synology-setup.md` for full deployment guide.

Quick start:
```bash
# On your Synology (via SSH)
git clone https://github.com/YOUR_USERNAME/hicks-hockey-pool.git
cd hicks-hockey-pool
cp .env.example .env
# Edit .env with production values
docker compose up -d
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, register, invite pages
│   ├── (dashboard)/     # Main app pages (picks, results, etc.)
│   ├── api/             # API routes
│   └── layout.tsx       # Root layout
├── components/
│   ├── ui/              # Base UI components
│   ├── picks/           # Weekly picks components
│   ├── stats/           # Team stats side panel
│   ├── suicide/         # Suicide pool components
│   ├── admin/           # Commissioner tools
│   ├── notifications/   # In-app notifications
│   └── layout/          # Nav, header, sidebar
├── lib/
│   ├── db/              # Prisma client
│   ├── api/             # NHL API client
│   ├── email/           # SendGrid email templates
│   ├── cron/            # Scheduled jobs
│   └── utils/           # Helpers, formatters
├── types/               # TypeScript types
└── auth.ts              # NextAuth config
```

---

## Weekly Schedule (EST)

| Time               | Event                                      |
|--------------------|--------------------------------------------|
| Monday 9am         | Results email sent to all players          |
| Thursday 3pm       | First reminder email (picks not submitted) |
| Friday 8am         | Second reminder email                      |
| Friday 2pm         | Picks locked, auto-pick fires, reveal email |
| Saturday / Sunday  | Games played                               |

---

## Founding Brothers

Founded by the three Hicks brothers. Est. 2025. 🏒
