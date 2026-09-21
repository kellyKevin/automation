# WhatsApp bot setup — from zero to a live conversation

This is the complete, step-by-step guide to putting the Farm City bot on
WhatsApp: getting a number, connecting it to this app, having the bot chat with
a real customer, and then going live. Follow it top to bottom the first time.

The app code is already written — you are **configuring Meta and your
environment**, not changing code. Wherever a value needs to land in the app,
this guide names the exact `.env` variable.

---

## 0. The big picture (read this once)

```
Customer's phone ──▶ WhatsApp ──▶ Meta Cloud API ──▶ (webhook POST)
                                                          │
                                        https://<you>/api/whatsapp/webhook
                                                          │
                                            this app (bot engine + database)
                                                          │
                                        reply ──▶ Meta Cloud API ──▶ Customer
```

Two things must be true for the bot to work:

1. **Meta can reach your webhook** over public HTTPS (`/api/whatsapp/webhook`).
2. **Your app can call Meta** using an access token + phone number ID.

That's the entire game. Everything below sets those two things up.

### Which "WhatsApp" you need

| Product | Runs this bot? |
| --- | --- |
| WhatsApp (personal app) | ❌ |
| WhatsApp **Business App** (free phone app) | ❌ canned replies only, no API |
| WhatsApp **Business Platform (Cloud API)** | ✅ **use this** |

> ⚠️ A phone number can live in **only one** place at a time. If the number you
> want to use is currently signed in to the personal app or the Business App,
> you must **delete that WhatsApp account first** (Settings → Account → Delete
> account) before Meta can register it on the Cloud API. Numbers already on the
> Cloud API cannot also be used in the phone apps.

---

## 1. Prerequisites

- A personal **Facebook account** (used only to log in to the developer tools).
- A **Meta Business Account** — create at <https://business.facebook.com>.
- For the *live* number: a phone number that can receive an **SMS or call OTP**
  and is **not** currently on any WhatsApp account. *(You do NOT need this to
  start — Meta provides a free test number in Part A.)*
- This app running somewhere reachable over HTTPS — a **tunnel** for local
  testing (Part A) or a **deployment** for production (Part F).

---

## PART A — Get the bot talking today (free test number)

You can have a real two-way conversation before buying anything, doing business
verification, or deploying. This is the fastest way to *see it work*.

### A1. Create the Meta app

1. Go to <https://developers.facebook.com> → log in → **My Apps** → **Create App**.
2. Use case: choose **Other** → app type **Business** → next.
3. Name it (e.g. "Farm City Bot"), pick your Business Account, **Create app**.
4. On the dashboard, find **WhatsApp** and click **Set up**. This creates a test
   WhatsApp Business Account and a **test phone number** for you.

### A2. Note your first credentials

On **WhatsApp → API Setup** you'll see:

- a **temporary access token** (valid 24h) → this is `WHATSAPP_TOKEN` for now,
- a **Phone number ID** (a long number, *not* the phone number) → `WHATSAPP_PHONE_NUMBER_ID`,
- a **From** test number Meta owns,
- a **To** field where you must **add your own phone number** as an allowed
  recipient (test mode can only message numbers you add here — up to 5).

Add your phone, then click **Send message** to fire the sample `hello_world`
template. Confirm it arrives on your phone. ✅ Meta → you now works.

### A3. Make your local app reachable (tunnel)

Meta must reach your webhook over public HTTPS. During development, tunnel your
local server:

```bash
# terminal 1 — run the app
npm install
cp .env.example .env
npx prisma db push
npm run seed
npm run dev            # http://localhost:3000

# terminal 2 — expose it publicly
npx cloudflared tunnel --url http://localhost:3000
#   ...or:  ngrok http 3000
```

Copy the `https://<something>.trycloudflare.com` (or ngrok) URL it prints.

### A4. Fill in `.env`

```ini
WHATSAPP_TOKEN="<temporary token from A2>"
WHATSAPP_PHONE_NUMBER_ID="<phone number ID from A2>"
WHATSAPP_VERIFY_TOKEN="farm-city-verify"   # any string you choose
# leave WHATSAPP_APP_SECRET blank for now (skips signature check locally)
```

Restart `npm run dev` after editing `.env`.

### A5. Register the webhook

1. In the app dashboard: **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL** = `https://<your-tunnel>/api/whatsapp/webhook`
3. **Verify token** = the exact `WHATSAPP_VERIFY_TOKEN` you set (`farm-city-verify`).
4. Click **Verify and save**. Meta calls your `GET` handler with a challenge;
   the app echoes it back and the webhook is accepted.
5. Under **Webhook fields**, click **Manage** and **Subscribe** to **`messages`**.

### A6. Talk to your bot 🎉

From the phone you added in A2, message the **test number** something like:

> Hello Farm City, I'd like to order 5 kg tomatoes and 2 trays of eggs.

The bot should reply with the item confirmation and buttons. Behind the scenes
it wrote `Customer`, `ConversationSession`, and `MessageLog` rows. Inspect them:

```bash
npx prisma studio        # opens a DB browser at http://localhost:5555
```

**If nothing happens, jump to [Troubleshooting](#part-e--troubleshooting).**

### A7. (Optional) simulate an inbound message without a phone

You can drive the exact same path with `curl`, useful for debugging:

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{
    "contacts":[{"wa_id":"254712345678","profile":{"name":"Grace"}}],
    "messages":[{"from":"254712345678","id":"wamid.test1","type":"text",
      "text":{"body":"Hello Farm City, I would like to place an order:\n1. Fresh Tomatoes - 5 kg (KSh 400)\nName: Grace\nDelivery Location: Juja"}}]
  }}]}]}'
```

Replies go out via the Cloud API (or are logged in dry-run mode if no token).

---

## PART B — What each credential is (reference)

| `.env` variable | Where it comes from | Notes |
| --- | --- | --- |
| `WHATSAPP_TOKEN` | API Setup (temp) → later a System User (permanent) | Bearer token for all Cloud API calls |
| `WHATSAPP_PHONE_NUMBER_ID` | API Setup | The **ID**, not the phone number |
| `WHATSAPP_VERIFY_TOKEN` | You invent it | Must match in the dashboard webhook config |
| `WHATSAPP_APP_SECRET` | App → Settings → Basic → **App secret** | Verifies `X-Hub-Signature-256`; set in production |
| `WHATSAPP_GRAPH_VERSION` | Optional | Defaults to `v21.0` |
| `TEAM_ALERT_WHATSAPP_NUMBER` | Your team's number (no `+`) | Gets new-order & handover alerts |
| `MPESA_PAYBILL`, `MPESA_ACCOUNT_PREFIX` | Your M-Pesa details | Shown to the customer in chat |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Your business number (no `+`) | Builds the storefront's `wa.me` links |
| `DATABASE_URL` | Your database | SQLite locally; Postgres in production (Part F) |

Phone numbers are always **international format without `+`** (e.g. Kenya
`254712345678`).

---

## PART C — Go live with your real number

Test mode is fine for building, but to message **any** customer (not just your 5
test numbers) and to stop the 24h token from expiring, do the following.

### C1. Add your real phone number

**WhatsApp → API Setup → Add phone number.** Enter your business number, choose
a **display name** (what customers see — e.g. "Farm City"), and verify by the
OTP sent via SMS/call. *(The number must not be on another WhatsApp account —
see the warning in §0.)*

### C2. Create a permanent access token

Temporary tokens die in 24h. Create a permanent one via a System User:

1. <https://business.facebook.com> → **Business Settings → Users → System users**.
2. **Add** → name it "farm-city-bot" → role **Admin** (or a limited role).
3. **Add assets** → assign your **app** (full control).
4. **Generate new token** → select the app → permissions
   **`whatsapp_business_messaging`** and **`whatsapp_business_management`** →
   generate. **Copy it now** (shown once) → put in `WHATSAPP_TOKEN`.

### C3. Turn on signature verification

Copy **App secret** (App → Settings → Basic) into `WHATSAPP_APP_SECRET`. From
now on the webhook rejects any `POST` whose `X-Hub-Signature-256` doesn't match
— this stops anyone from forging fake customer messages.

### C4. Business verification & display-name review

To raise sending limits and remove test restrictions, Meta requires:

- **Business verification** (Business Settings → Security Centre) — upload
  business documents; approval can take a few days.
- **Display-name review** — your chosen name is checked against Meta's naming
  rules.

Until these pass, the number runs with the lowest tier / test limits.

---

## PART D — The rules you must know (messaging & AI)

Meta **allows** bots and AI/automated replies — you don't need permission to
automate and don't have to label the bot (though offering "talk to a human" is
good practice). The constraints are about **messaging**, not the automation:

- **24-hour customer service window.** When a customer messages you, you may
  reply with **free-form messages for 24 hours** — this is where the whole bot
  conversation runs, and it's **free**. After 24h of silence you can only send
  **pre-approved templates**.
- **Message templates.** Reusable, Meta-approved messages to re-engage outside
  the window (e.g. "Your order is dispatched"). Categories: **utility**,
  **marketing**, **authentication** — created under **WhatsApp Manager →
  Message templates** and approved within minutes–hours. Your days-later
  seedling status updates need these.
- **Pricing.** Meta bills **per template message** (rate varies by country —
  check the official *WhatsApp pricing* page for **Kenya**). Customer-initiated
  **service conversations** — your in-window bot chat — are **free**.
  **M-Pesa is entirely separate**; WhatsApp never touches the payment, the bot
  just sends pay instructions and reads the confirmation.
- **Opt-in.** To message people with **templates** you need prior consent (a
  form tick, a "message us" button, etc.). Replying within the window to someone
  who messaged you first needs no extra opt-in.
- **Quality rating & limits.** Each number has a quality score (green/yellow/red)
  and tiered daily limits (**250 → 1K → 10K → 100K → unlimited**) that grow
  automatically with good behaviour and shrink if people block/report you.
- **Policies.** Follow Meta's **Business Messaging Policy** and **Commerce
  Policy**. Fresh produce and seedlings are allowed.
- **AI later (optional).** The bot today is a rule-based state machine — cheap,
  predictable, no hallucinations. If you later want an LLM (e.g. Claude) to
  answer open questions like "how do I care for passion-fruit seedlings?", it
  slots into the free-text branch **inside the 24h window**; Meta permits
  AI-generated replies.

---

## PART E — Troubleshooting

| Symptom | Likely cause & fix |
| --- | --- |
| Webhook "Verify and save" fails | App not reachable / wrong URL. Confirm the tunnel is running and the URL ends in `/api/whatsapp/webhook`. Confirm `WHATSAPP_VERIFY_TOKEN` matches exactly. Test: open the callback URL with `?hub.mode=subscribe&hub.verify_token=YOURTOKEN&hub.challenge=123` — it should return `123`. |
| Bot never replies to a message | You didn't **Subscribe to `messages`** (A5.5). Or the tunnel URL changed (free tunnels rotate on restart) — re-enter it. Check the app logs for the incoming `POST`. |
| `POST` returns 401 Invalid signature | `WHATSAPP_APP_SECRET` is set but wrong. Fix it, or unset it locally to skip the check. |
| Send fails: recipient not in allowed list (error 131030) | Test mode — add the recipient under API Setup, or finish going live (Part C). |
| Send fails: token expired / 190 | Temporary token expired (24h). Create a permanent token (C2). |
| Messages send but bot logic is off | Not a Meta issue — run `npm test`; the engine is fully testable without WhatsApp. |
| Replies only appear in logs, never on the phone | App is in **dry-run** mode — `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` not set. Fill them in and restart. |

---

## PART F — Production deployment

1. **Deploy** the app to a stable HTTPS host (e.g. Vercel). Set all the `.env`
   values from Part B as the host's environment variables.
2. **Database:** SQLite does not work on serverless. Use hosted **Postgres**:
   - change `prisma/schema.prisma` datasource `provider` to `"postgresql"`,
   - set `DATABASE_URL` to the Postgres connection string,
   - run `npx prisma migrate deploy` (or `db push`) then `npm run seed`.
3. **Webhook:** in the Meta dashboard set the Callback URL to your real domain
   `https://<domain>/api/whatsapp/webhook` (no more tunnel) and keep `messages`
   subscribed.
4. **Templates:** create utility templates for the out-of-window updates
   (Dispatched, Out for delivery) and wire them in `src/lib/orders/messages.ts`.
5. **Secrets:** ensure `WHATSAPP_APP_SECRET` is set so signatures are verified.

---

## Quick checklist

- [ ] Meta app created, WhatsApp product added
- [ ] Test number works (sample message received)
- [ ] App running + tunnel (or deployed) over HTTPS
- [ ] `.env`: token, phone number ID, verify token set
- [ ] Webhook verified and **`messages`** subscribed
- [ ] Real message to the number gets a bot reply
- [ ] Rows visible in `npx prisma studio`
- [ ] (Live) real number added + permanent token + app secret
- [ ] (Live) business verification + display name approved
- [ ] (Live) Postgres + deployment + real callback URL
- [ ] (Live) utility templates created for status updates

---

**Related:** the receive→store pipeline and env-var reference are also in the
main [`README.md`](../README.md).
