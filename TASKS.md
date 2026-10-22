# Tasks

Project backlog for the restaurant app. Specs: [architecture.md](architecture.md), [features.md](features.md), [.cursorrules](.cursorrules).

## How to use

Tell the agent **execute T03** (or **T03.2**, or **US-03**). The agent implements that item, then updates this file:

- Sub-task: `- [ ]` → `- [x]`
- Task **Status:** `todo` → `in_progress` → `done` (only `done` if every sub-task is `[x]` and acceptance criteria hold)
- Story **Status:** `done` when all of its tasks are `done`
- Refresh **Progress** below

Do not skip dependencies listed on the task. Do not add TypeScript, Mongoose, MVC, schema files, or extra backend folders.

**Status values:** `todo` | `in_progress` | `done`

## Progress

| ID | Story | Status |
| --- | --- | --- |
| US-01 | Scaffold client and server | in_progress |
| US-02 | Sign up, sign in, roles | todo |
| US-03 | Shared shell (nav, API helper, cart lib) | todo |
| US-04 | Public home | todo |
| US-05 | Browse menu | todo |
| US-06 | Admin menu CRUD | todo |
| US-07 | Tables | todo |
| US-08 | Cart and place order | todo |
| US-09 | Customer orders | todo |
| US-10 | Kitchen orders board | todo |
| US-11 | Customer reservations | todo |
| US-12 | Staff reservations | todo |
| US-13 | Billing | todo |
| US-14 | Customer bills | todo |
| US-15 | Staff accounts | todo |
| US-16 | Dashboard overview | todo |

---

## US-01 Scaffold client and server

**Status:** in_progress  
**As a** developer, **I want** a runnable Next.js app and a one-file Express API **so that** later stories have a place to land.

Depends on: nothing

### T01 Create the two apps

**Status:** in_progress

- [ ] T01.1 `client/` Next.js App Router, JavaScript only (`jsconfig.json`, no TypeScript). Tailwind + DaisyUI. `"js"` pages.
- [ ] T01.2 Folder tree from architecture.md (`app/`, `components/`, `lib/`, `dashboard/` routes can be empty placeholders).
- [ ] T01.3 `server/index.js` ESM (`"type": "module"`). Express, CORS with credentials, `MongoClient` connect, health `GET /api/health` → `{ ok: true }`. Env: `MONGODB_URI`, `DB_NAME`, `PORT`, `CLIENT_ORIGIN`.
- [ ] T01.4 README: how to run client and server (two processes). Example `.env` files, not secrets.

**Acceptance**

- `npm run dev` in client shows the Next app.
- `node index.js` (or npm script) in server responds on `/api/health`.
- No `.ts` / `.tsx` / Mongoose.

---

## US-02 Sign up, sign in, roles

**Status:** todo  
**As a** diner, **I want** an account with role `customer` **so that** I can order and reserve.

Depends on: T01

### T02 Better Auth and role gates

**Status:** todo

- [ ] T02.1 Better Auth email/password in the Next app; session cookie; Express verifies the same session on mutating/dashboard routes. Default `role: "customer"` on sign-up.
- [ ] T02.2 Pages `/sign-in`, `/sign-up`. After auth, return to the page they wanted (cart, reservations).
- [ ] T02.3 `account/layout.js`: unauthenticated → `/sign-in`. `dashboard/layout.js`: not staff/admin → `/`.
- [ ] T02.4 Navbar: sign in / sign out; show name when signed in.

**Acceptance**

- New user is `customer` and cannot open `/dashboard`.
- Staff/admin (role set in DB for now) can open `/dashboard`.
- API mutations without a session return `{ ok: false, error }` (not 200 success).
- Client never sends `userId` for authorization.

---

## US-03 Shared shell

**Status:** todo  
**As a** user, **I want** a consistent DaisyUI chrome and API helper **so that** pages look and fetch the same way.

Depends on: T02

### T03 Nav, helpers, empty states

**Status:** todo

- [ ] T03.1 `Navbar.js`, `Footer.js`, `StatusBadge.js`. Root `layout.js` wraps pages.
- [ ] T03.2 `lib/api.js` — `fetch` to Express with `credentials: "include"`; parse `{ ok, data, error }`.
- [ ] T03.3 `lib/format.js` — cents ↔ display dollars.
- [ ] T03.4 `lib/cart.js` — localStorage cart (add, qty, remove, clear, notes).
- [ ] T03.5 `components/dashboard/Sidebar.js` — Overview, Orders, Tables, Reservations, Billing; Menu + Staff links only if admin.

**Acceptance**

- Lists can show loading, empty, and error `alert` using shared patterns.
- Cart survives a refresh (localStorage).
- Admin sees Menu and Staff in the sidebar; staff does not.

---

## US-04 Public home

**Status:** todo  
**As a** guest, **I want** a simple home page **so that** I can reach the menu and reservations.

Depends on: T03

### T04 Home page

**Status:** todo

- [ ] T04.1 `/` — restaurant name, short pitch, hours, buttons to `/menu` and `/reservations`.

**Acceptance**

- Guest can open `/` without signing in.
- Buttons go to menu and reserve.

---

## US-05 Browse menu

**Status:** todo  
**As a** guest, **I want** to see available dishes **so that** I know what to order.

Depends on: T01 (API), T03 (UI)

### T05 Public menu API and page

**Status:** todo

- [ ] T05.1 `GET /api/menu` — items with `available: true`. No auth. Fields per features.md.
- [ ] T05.2 `/menu` — cards grouped by category; price via `format.js`.
- [ ] T05.3 Signed in: Add to cart. Guest: link to `/sign-in`.

**Acceptance**

- Hidden items (`available: false`) do not appear.
- Guest can view; only signed-in users add to cart.
- Empty menu shows an empty state.

---

## US-06 Admin menu CRUD

**Status:** todo  
**As an** admin, **I want** to add and hide dishes **so that** the public menu stays current.

Depends on: T02, T05

### T06 Dashboard menu

**Status:** todo

- [ ] T06.1 `POST/PATCH/DELETE /api/menu` — admin only. Validate name, price (cents ≥ 0), category, available.
- [ ] T06.2 `/dashboard/menu` — table of all items; modal create/edit; hide via `available: false`. Price input in dollars, stored as cents.

**Acceptance**

- Staff gets forbidden on writes.
- New available item shows on `/menu`; hidden item does not.
- Public `GET` still unauthenticated.

---

## US-07 Tables

**Status:** todo  
**As** staff, **I want** to see and set table status **so that** the floor is accurate.

Depends on: T02, T03

### T07 Tables API and dashboard

**Status:** todo

- [ ] T07.1 `GET /api/tables` — staff/admin (and customer session for open tables at checkout). `POST` add table — admin. `PATCH` status — staff/admin. Unique `number`. Status: `available` \| `occupied` \| `reserved`.
- [ ] T07.2 Unique index on `tables.number` at server startup (in `index.js`, no schema file).
- [ ] T07.3 `/dashboard/tables` — grid of `TableCard`; set available / occupy / reserve; admin add table (number, seats).

**Acceptance**

- Duplicate table number is rejected.
- Status badge updates after PATCH.
- Customer cannot add tables.

---

## US-08 Cart and place order

**Status:** todo  
**As a** customer, **I want** to submit my cart as an order **so that** the kitchen can cook it.

Depends on: T05, T07

### T08 Checkout

**Status:** todo

- [ ] T08.1 `/cart` — lines, qty, per-line notes, remove; dine-in (`tableId` from available/open tables) or takeaway; order notes. Block empty cart and dine-in without table.
- [ ] T08.2 `POST /api/orders` — session customer; snapshot `name`/`price`; `subtotal`; `status: pending`; `placedBy: customer`; dine-in sets table `occupied`.
- [ ] T08.3 On success: clear cart, go to `/account/orders`.

**Acceptance**

- Takeaway has no `tableId` and does not change tables.
- Line prices stay the old snapshot if the menu price changes later.
- Unauthenticated POST is rejected.

---

## US-09 Customer orders

**Status:** todo  
**As a** customer, **I want** to see my orders **so that** I know the status.

Depends on: T08

### T09 Account orders

**Status:** todo

- [ ] T09.1 `GET /api/orders` — customer: own only. Newest first.
- [ ] T09.2 `/account/orders` — list, `StatusBadge`, expand items; link to bill when present (may be empty until US-13).

**Acceptance**

- Customer A cannot see customer B’s orders.
- Loading / empty / error states work.

---

## US-10 Kitchen orders board

**Status:** todo  
**As** staff, **I want** to move orders through the kitchen **so that** food goes out in order.

Depends on: T08

### T10 Board, status, walk-in

**Status:** todo

- [ ] T10.1 `GET /api/orders` — staff/admin: all. `PATCH /api/orders/:id/status` — only legal transitions (`pending` → `preparing` → `ready` → `served`; cancel from `pending`/`preparing`). `paid` is **not** set here.
- [ ] T10.2 `POST /api/orders` as staff — walk-in (`placedBy: staff`, `tableId` optional).
- [ ] T10.3 `/dashboard/orders` — tabs/columns by status; next-status buttons only; cancel when allowed; poll ~5s. Walk-in modal.

**Acceptance**

- Skipping `preparing` is rejected.
- Kitchen cannot mark `paid`.
- Walk-in appears on the board as `pending`.

---

## US-11 Customer reservations

**Status:** todo  
**As a** customer, **I want** to book a table **so that** we have a seat later.

Depends on: T02, T03

### T11 Reservation form and list

**Status:** todo

- [ ] T11.1 `POST /api/reservations` — customer; `guestName`, `partySize`, `datetime` required; `status: pending`; `userId` from session. `GET` own. `PATCH` cancel if `pending` or `confirmed`.
- [ ] T11.2 `/reservations` — form + upcoming list + cancel.

**Acceptance**

- Guest is sent to sign-in.
- Cancelled rows do not stay “upcoming”.
- Customer cannot confirm or seat (staff only).

---

## US-12 Staff reservations

**Status:** todo  
**As** staff, **I want** to confirm and seat bookings **so that** the floor matches the book.

Depends on: T07, T11

### T12 Dashboard reservations

**Status:** todo

- [ ] T12.1 Staff `GET` all; `PATCH` confirm (optional `tableId` → table `reserved`), seat (`seated`, table `occupied`), no-show, cancel (free table if reserved for this booking). Reject obvious overlap: same `tableId` already `confirmed`/`seated` at a close datetime.
- [ ] T12.2 `/dashboard/reservations` — day filter; those actions; optional walk-in create.

**Acceptance**

- Seating an assigned table sets `occupied`.
- Cancel/no-show sets that table `available` when it was reserved for this row.
- Overlap assign is `{ ok: false, error }`.

---

## US-13 Billing

**Status:** todo  
**As** staff, **I want** to take payment on a served order **so that** the table can turn.

Depends on: T10, T07

### T13 Bills API and dashboard

**Status:** todo

- [ ] T13.1 `POST /api/bills` from served order — copy lines; tax constant in `index.js`; `total`; `unpaid`. Unique `orderId`. One bill per order.
- [ ] T13.2 `PATCH /api/bills/:id/pay` — `cash` \| `card`; set `paid`, `paidAt`; order `paid`; dine-in table `available`. Void unpaid only.
- [ ] T13.3 `/dashboard/billing` — served-without-bill → create; unpaid → pay/void.

**Acceptance**

- Second bill for the same order is rejected.
- Pay is the only way an order becomes `paid`.
- No Stripe or card capture.

---

## US-14 Customer bills

**Status:** todo  
**As a** customer, **I want** to see my bills **so that** I know what I owe or paid.

Depends on: T13

### T14 Account bills

**Status:** todo

- [ ] T14.1 `GET /api/bills` — customer: own only.
- [ ] T14.2 `/account/bills` — read-only list: status, totals, method if paid. No self-pay.
- [ ] T14.3 `/account/orders` links to the matching bill.

**Acceptance**

- Customer cannot pay or void.
- Own bills only.

---

## US-15 Staff accounts

**Status:** todo  
**As an** admin, **I want** to set roles **so that** floor staff can use the dashboard.

Depends on: T02

### T15 Staff page

**Status:** todo

- [ ] T15.1 `GET /api/staff` — users with role staff or admin. `PATCH` role by user id or email (`customer` \| `staff` \| `admin`). Admin only.
- [ ] T15.2 `/dashboard/staff` — list; promote by email; change role. Staff users do not see this nav item.

**Acceptance**

- Staff cannot PATCH roles.
- After promote, that user can open `/dashboard` on next request.
- Demote to customer blocks dashboard.

---

## US-16 Dashboard overview

**Status:** todo  
**As** staff, **I want** counts on one screen **so that** I see the shift at a glance.

Depends on: T07, T10, T12, T13

### T16 Overview stats

**Status:** todo

- [ ] T16.1 `GET /api/dashboard/summary` or equivalent counts in existing GETs: open orders (not served/paid/cancelled), occupied tables, today’s pending/confirmed reservations, unpaid bills.
- [ ] T16.2 `/dashboard` — `StatCard`s; staff and admin.

**Acceptance**

- Numbers match the lists on the other dashboard pages.
- Customer cannot call the summary API.

---

## Notes for executors

- JSON: `{ ok: true, data }` or `{ ok: false, error }`.
- Money: integer cents. Tax rate: constant in `server/index.js`.
- Poll orders board; no sockets.
- When a task is `done`, tick every sub-task and set Status lines + Progress table.
