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
| `MONGODB_URI` | client + server | Mongo connection (auth + API data) |
| `DB_NAME` | client + server | Database name |
| `PORT` | server | API port (default 4000) |
| `CLIENT_ORIGIN` | server | CORS origin (default http://localhost:3000) |
| `BETTER_AUTH_SECRET` | client | Session signing secret (Better Auth on Next.js) |
| `BETTER_AUTH_URL` | client | App URL for auth (default http://localhost:3000) |
| `NEXT_PUBLIC_APP_URL` | client | Browser origin (default http://localhost:3000) |
| `API_ORIGIN` | client | Express URL for Next rewrites of non-auth `/api/*` (default http://localhost:4000) |

Better Auth runs on **Next.js** at `/api/auth/*`. Express verifies the same session cookie on protected routes.

Copy `client/.env.example` to `client/.env.local` before running the client.

Do not commit `.env` files.

## Stripe (optional)

Orders → served → staff **create bill** → customer **Pay with card** or staff **cash/card (manual)**.

| Variable | Where | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | server | Checkout Sessions + webhook verification |
| `STRIPE_WEBHOOK_SECRET` | server | Signing secret from Stripe Dashboard or CLI |
| `STRIPE_PUBLISHABLE_KEY` | server | Exposed via `GET /api/payments/config` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | Optional; for future Stripe.js / Elements |
| `TAX_RATE` | server | Bill tax rate (default `0.1`) |

**Endpoints**

- `POST /api/bills/:id/stripe/checkout` — returns `{ checkoutUrl }` (customer own bill, or staff)
- `POST /api/webhooks/stripe` — raw body; handles `checkout.session.completed`

**Local webhooks**

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

Set `STRIPE_WEBHOOK_SECRET` to the secret printed by the CLI.
