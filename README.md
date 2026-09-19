# Farm City — WhatsApp ordering flow

The website is the shop window; everything after **"Order on WhatsApp"** happens
inside WhatsApp, driven by a bot and recorded in a database. This repo implements
that flow end to end:

- a **storefront** (Next.js) that builds a cart and hands it off to WhatsApp,
- a **WhatsApp bot** (Meta Cloud API webhook) that confirms items, collects
  delivery details, takes payment, and sends status updates,
- a **database** (Prisma) that records every customer, order, and status change,
- an **admin panel** to advance orders through their lifecycle.

## How it fits together

```
Website cart ──"Order on WhatsApp"──▶ wa.me link (pre-filled message + Ref)
       │
       ▼
WhatsApp ──▶ /api/whatsapp/webhook ──▶ bot engine (pure state machine)
                                          │  greet → confirm items → name
                                          │  → delivery details → summary
                                          │  → confirm → payment → updates
                                          ▼
                                   Prisma database (orders, payments, history)
                                          ▲
                            Admin panel (/admin) advances status,
                            notifying the customer on each change.
```

## Order status lifecycle

`NEW → CONFIRMED → PAID → PACKED → OUT_FOR_DELIVERY / DISPATCHED → DELIVERED`

Any order can also become `CANCELLED` or `ON_HOLD`. Transitions are enforced in
`src/domain/index.ts` (`canTransition`) and every change is written to
`StatusHistory` with who made it.

## Project layout

| Path | What it does |
| --- | --- |
| `prisma/schema.prisma` | All tables: customers, products, zones, orders, items, deliveries, payments, status history, conversation sessions, message log, bulk quotes, staff. |
| `prisma/seed.ts` | Demo produce, seedlings, and delivery zones. |
| `src/domain/` | Status/step vocabularies and the lifecycle transition rules. |
| `src/lib/cart.ts` | Cart → WhatsApp message format, `wa.me` link builder, and the inbound message parser. |
| `src/lib/whatsapp/` | Cloud API client, message builders, webhook signature check, inbound normaliser. |
| `src/lib/bot/engine.ts` | **Pure** conversation state machine — takes a step + draft + message, returns replies + effects. No I/O, fully unit-tested. |
| `src/lib/bot/runtime.ts` | Glues the engine to Prisma and the WhatsApp client. |
| `src/lib/orders/` | Order numbering (`FC-0001`), totals, status changes, payment records, customer messages. |
| `src/app/` | Storefront (`/`), admin panel (`/admin`), and API routes. |

The engine is deliberately I/O-free so the whole conversation can be tested
without a database or a live WhatsApp app (see `tests/engine.test.ts`).

## Getting started

```bash
npm install
cp .env.example .env          # fill in real values for production
npx prisma db push            # create the SQLite dev database
npm run seed                  # load demo products & zones
npm run dev                   # http://localhost:3000  (shop) and /admin
```

### Run the checks

```bash
npm test          # unit tests (vitest)
npm run typecheck # tsc --noEmit
npm run build     # production build
```

## Connecting the WhatsApp Cloud API

1. Create a Meta app with the **WhatsApp** product and note the
   **Phone number ID** and a **permanent access token**.
2. Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`,
   and `WHATSAPP_APP_SECRET` in `.env`.
3. Point the webhook at `https://<your-domain>/api/whatsapp/webhook` and use the
   same `WHATSAPP_VERIFY_TOKEN` — the `GET` handler completes the handshake, and
   the `POST` handler validates Meta's `X-Hub-Signature-256`.
4. Subscribe to the **messages** field.

Without credentials the client runs in **dry-run** mode: it logs the payload it
would send, so the entire flow can be exercised locally.

## Database of record

Prices and product names are copied onto each order at order time, so later
catalogue changes never rewrite history. Stock is decremented when an order is
created. The customer is identified by their WhatsApp number (no duplicates),
order numbers are sequential and unique, and records are cancelled rather than
deleted.

## Notes & next steps

- **Mixed carts** (produce + seedlings, which ship from different places) are
  currently handed to a person. Splitting them into two linked orders
  automatically is the natural next step (the schema already supports
  `linkedOrderId`).
- Out-of-hours / unpaid-order reminders can be driven by a scheduled job over
  `Order.status` + `Payment.status`.
- Status updates beyond the 24-hour WhatsApp window need pre-approved message
  templates; the message builders in `src/lib/orders/messages.ts` are the place
  to wire those in.
