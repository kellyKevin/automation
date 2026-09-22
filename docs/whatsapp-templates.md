# WhatsApp message templates (submit these in Meta)

Templates are the only messages the bot may send **outside** the 24-hour
window (e.g. a status update sent the next day). Each must be **created and
approved** in the Meta dashboard **before** the bot can send it, and **per
language** — so create both the **English (`en`)** and **Swahili (`sw`)**
version of each. The bot picks the version matching the customer's language
(stored on `Customer.lang`, detected from their chat).

## Where to create them
Meta → **WhatsApp Manager** → **Message templates** → **Create template**.
For each one set:
- **Name** — exactly as below (lowercase, underscores). The code sends by this name.
- **Category** — **Utility** for all of these (order/account updates), except
  `payment_reminder` which is also Utility.
- **Language** — add **English** and **Swahili** as separate versions of the
  same template name.
- **Body** — copy the text below. `{{1}}`, `{{2}}`… are variables the bot fills
  in order (shown after each template). Add a **sample value** for each when Meta
  asks, so it can review.

Placeholders must match the order the code sends (see `src/lib/whatsapp/templates.ts`).

---

## 1. order_received  — variables: {{1}} order number, {{2}} total
- **EN:** `Order {{1}} received. Total {{2}}. We'll confirm stock and get back to you shortly.`
- **SW:** `Oda {{1}} imepokelewa. Jumla {{2}}. Tutathibitisha stoku na kukujibu hivi punde.`
- Sample: `{{1}}` = `FC-0007`, `{{2}}` = `KSh 1,200`

## 2. payment_received  — variables: {{1}} order number
- **EN:** `Payment received for order {{1}}. Thank you! We're preparing your order.`
- **SW:** `Malipo ya oda {{1}} yamepokelewa. Asante! Tunaandaa oda yako.`
- Sample: `{{1}}` = `FC-0007`

## 3. payment_reminder  — variables: {{1}} order number, {{2}} amount, {{3}} paybill
- **EN:** `Reminder: order {{1}} is awaiting payment of {{2}}. Pay via M-Pesa Paybill {{3}} (account {{1}}), then reply with the confirmation.`
- **SW:** `Kumbusho: oda {{1}} inasubiri malipo ya {{2}}. Lipa kupitia M-Pesa Paybill {{3}} (akaunti {{1}}), kisha jibu na uthibitisho.`
- Sample: `{{1}}` = `FC-0007`, `{{2}}` = `KSh 1,200`, `{{3}}` = `247247`

## 4. order_packed  — variables: {{1}} order number
- **EN:** `Good news — order {{1}} is packed and ready. 📦`
- **SW:** `Habari njema — oda {{1}} imefungwa tayari. 📦`
- Sample: `{{1}}` = `FC-0007`

## 5. out_for_delivery  — variables: {{1}} order number, {{2}} rider, {{3}} rider phone
- **EN:** `Order {{1}} is on the way. Rider: {{2}}, {{3}}.`
- **SW:** `Oda {{1}} iko njiani. Dereva: {{2}}, {{3}}.`
- Sample: `{{1}}` = `FC-0007`, `{{2}}` = `Sam`, `{{3}}` = `0712000000`

## 6. seedlings_dispatched  — variables: {{1}} order, {{2}} carrier, {{3}} tracking, {{4}} ETA
- **EN:** `Order {{1}} dispatched via {{2}}. Tracking: {{3}}. Expected arrival: {{4}}.`
- **SW:** `Oda {{1}} imetumwa kupitia {{2}}. Ufuatiliaji: {{3}}. Inatarajiwa kufika: {{4}}.`
- Sample: `{{1}}` = `FC-0011`, `{{2}}` = `G4S`, `{{3}}` = `TRK123`, `{{4}}` = `Tue`

## 7. order_delivered  — variables: {{1}} order number
- **EN:** `Order {{1}} delivered. Thank you for shopping with Farm City! 🌱`
- **SW:** `Oda {{1}} imefikishwa. Asante kwa kununua na Farm City! 🌱`
- Sample: `{{1}}` = `FC-0007`

## 8. quote_ready  — variables: {{1}} name, {{2}} amount
- **EN:** `Hi {{1}}, your Farm City bulk quote is ready: {{2}}. Reply here and we'll help you place the order.`
- **SW:** `Habari {{1}}, nukuu yako ya jumla ya Farm City iko tayari: {{2}}. Jibu hapa na tutakusaidia kuweka oda.`
- Sample: `{{1}}` = `Green School`, `{{2}}` = `KSh 40,000`

## 9. standing_order_confirm  — variables: {{1}} name, {{2}} schedule
- **EN:** `Hi {{1}}, your standing order ({{2}}) is confirmed and being prepared. We'll send the details shortly.`
- **SW:** `Habari {{1}}, oda yako ya kudumu ({{2}}) imethibitishwa na inaandaliwa. Tutatuma maelezo hivi punde.`
- Sample: `{{1}}` = `Hotel Bravo`, `{{2}}` = `Weekly`

---

## After approval
- Approval usually takes minutes to a few hours. The template shows **Approved**
  in WhatsApp Manager when ready.
- The bot uses the customer's language automatically. If a customer's language is
  Swahili but only the English version is approved, that one out-of-window send
  will fail until the Swahili version is approved — so approve both.
- Inside the 24-hour window nothing here is needed: the bot sends normal
  free-form messages (already fully bilingual).
