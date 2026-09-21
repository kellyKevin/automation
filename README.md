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

## The WhatsApp bot: receiving messages and storing them

This is the heart of the system — how a message a customer types in WhatsApp
reaches the code and ends up in the database.

### The receive → store pipeline

```
Customer's WhatsApp
      │  (Meta delivers a webhook POST)
      ▼
POST /api/whatsapp/webhook            src/app/api/whatsapp/webhook/route.ts
      │  1. verify X-Hub-Signature-256 (HMAC of the raw body, WHATSAPP_APP_SECRET)
      │  2. parseInbound(body)         src/lib/whatsapp/inbound.ts
      │     → { from, messageId, profileName, text, replyId, type }
      ▼
processInbound(msg)                    src/lib/bot/runtime.ts
      │  3. log the inbound message           → MessageLog (direction = IN)
      │  4. upsert the customer by phone       → Customer
      │  5. load / create their session        → ConversationSession
      │  6. snapshot the catalogue (Products + active DeliveryZones)
      ▼
handleTurn(input)                      src/lib/bot/engine.ts  (pure, no I/O)
      │  returns { step, draft, replies[], effects[] }
      ▼
runtime executes the effects, persisting to the database:
      │  • SAVE_CUSTOMER_NAME     → Customer.name
      │  • CREATE_ORDER           → Order + OrderItem + Delivery + StatusHistory,
      │                             decrements Product.stock, stamps firstOrderAt
      │  • RECORD_MPESA_CODE      → Payment (method MPESA, status PENDING)
      │  • MARK_CASH_ON_DELIVERY  → Payment (method CASH_ON_DELIVERY)
      │  • OPT_OUT                → Customer.optedOut = true
      │  • HANDOVER               → alerts the team's WhatsApp number
      │  7. save the new step + draft          → ConversationSession
      │  8. send each reply via the Cloud API  → MessageLog (direction = OUT)
      ▼
The webhook returns 200 immediately (errors are logged, never 5xx to Meta,
so Meta does not retry).
```

The customer is always identified by their **WhatsApp phone number**, so the
same person never creates a duplicate `Customer` row. Between messages, the
half-finished order lives as JSON in `ConversationSession.draft` together with
the current `step`, which is how the bot "remembers" where each customer is even
if they go quiet for an hour and come back.

### Which table each step writes

| When | Table(s) written |
| --- | --- |
| Every inbound message | `MessageLog` (IN) |
| Every reply the bot sends | `MessageLog` (OUT) |
| First message from a new number | `Customer` |
| Name captured / stated in the message | `Customer.name` |
| Every turn | `ConversationSession` (step + draft) |
| Customer taps **Confirm order** | `Order`, `OrderItem`, `Delivery`, `StatusHistory`; `Product.stock` decremented |
| Customer sends an M-Pesa code / picks cash | `Payment` |
| Staff advance the order in `/admin` | `Order.status`, `StatusHistory`, `Payment` (on PAID) |

### Connecting a live WhatsApp number (Meta Cloud API)

> 📖 For a full click-by-click walkthrough — creating the Meta app, using the
> free test number, tunnelling your local webhook, getting a permanent token,
> business verification, the messaging rules, and troubleshooting — see
> [`docs/whatsapp-setup.md`](docs/whatsapp-setup.md). The summary below is the
> short version.

1. In the [Meta for Developers](https://developers.facebook.com/) console, create
   an app and add the **WhatsApp** product. Note the **Phone number ID** (not the
   phone number itself) and generate a **permanent** access token (via a System
   User) — a temporary token expires in 24 hours.
2. Copy the **App secret** (App settings → Basic). It's used to verify that each
   webhook really came from Meta.
3. Set these in `.env` (production: your host's env vars):

   | Variable | What it is |
   | --- | --- |
   | `WHATSAPP_TOKEN` | Permanent access token |
   | `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from the dashboard |
   | `WHATSAPP_VERIFY_TOKEN` | Any string you invent; Meta echoes it back on setup |
   | `WHATSAPP_APP_SECRET` | App secret (validates `X-Hub-Signature-256`) |
   | `WHATSAPP_GRAPH_VERSION` | Graph API version, e.g. `v21.0` |
   | `TEAM_ALERT_WHATSAPP_NUMBER` | Where new-order / handover alerts are sent |
   | `MPESA_PAYBILL`, `MPESA_ACCOUNT_PREFIX` | Payment details shown in chat |
   | `DATABASE_URL` | Your database (see below) |

4. Deploy the app, then in the Meta dashboard → **WhatsApp → Configuration**, set
   the **Callback URL** to `https://<your-domain>/api/whatsapp/webhook` and the
   **Verify token** to the same `WHATSAPP_VERIFY_TOKEN`. Click **Verify and
   save** — the `GET` handler answers Meta's handshake.
5. **Subscribe** to the `messages` webhook field. Inbound customer messages now
   arrive as `POST`s and flow through the pipeline above.

Without these credentials the Cloud API client runs in **dry-run** mode: it logs
the payload it would send instead of calling Meta, so the whole flow can be
exercised locally end to end.

### Testing the pipeline locally

The engine is covered by unit tests (`npm test`), and you can drive the full
receive → store path against your dev database by simulating a Meta webhook
`POST` (omit `WHATSAPP_APP_SECRET` locally to skip the signature check):

```bash
npm run dev   # in one terminal

curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{ "changes": [{ "value": {
      "contacts": [{ "wa_id": "254712345678", "profile": { "name": "Grace" } }],
      "messages": [{ "from": "254712345678", "id": "wamid.1", "type": "text",
                     "text": { "body": "Hello Farm City, I would like to place an order:\n1. Fresh Tomatoes - 5 kg (KSh 400)\nName: Grace\nDelivery Location: Juja" } }]
    }}]}]
  }'
```

After the call, the rows appear in the database — inspect them with
`npx prisma studio`, or from the storefront's `/admin` page once an order is
confirmed.

## Production database

SQLite (`DATABASE_URL="file:./dev.db"`) is fine for local development, but it
does **not** work on serverless hosts like Vercel (the filesystem is read-only
and ephemeral). For production use a hosted Postgres (Vercel Postgres, Neon,
Supabase, RDS, …):

1. Change the datasource in `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Point `DATABASE_URL` at the Postgres connection string.
3. Create the tables and seed the catalogue:
   ```bash
   npx prisma migrate deploy   # or: npx prisma db push
   npm run seed
   ```

The schema itself is portable — no SQLite-only features are used (enums are
modelled as validated string columns), so only the `provider` line changes.

## Database of record

Prices and product names are copied onto each order at order time, so later
catalogue changes never rewrite history. Stock is decremented when an order is
created. The customer is identified by their WhatsApp number (no duplicates),
order numbers are sequential and unique, every status change is timestamped in
`StatusHistory`, and records are cancelled rather than deleted. The full
conversation is retained in `MessageLog` for support and disputes.

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
