# Restaurant management

Monorepo: Next.js client + Express API. See [architecture.md](architecture.md), [features.md](features.md), [TASKS.md](TASKS.md).

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

## Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

API default: `http://localhost:4000` — health check: `GET /api/health`

## Client

```bash
cd client
npm install
npm run dev
```

App default: `http://localhost:3000`

## Env

| Variable | Where | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | server | Mongo connection |
| `DB_NAME` | server | Database name |
| `PORT` | server | API port (default 4000) |
| `CLIENT_ORIGIN` | server | CORS origin (default http://localhost:3000) |

Do not commit `.env` files.
