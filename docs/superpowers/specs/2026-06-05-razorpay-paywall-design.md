# Razorpay Paywall + Credits Design

**Date:** 2026-06-05
**Status:** Approved

## Overview

Add a credit-based paywall to RivalEye. Every user gets 1 free competitor scan. After that they must buy credit packs. 1 scan costs 1 credit. Payments handled via Razorpay Checkout (popup). No subscription model — pure pay-as-you-go credits.

---

## Credit Packs

| Name    | Credits | Price (INR) | Price (paise) |
|---------|---------|-------------|---------------|
| Starter | 10      | ₹999        | 99900         |
| Growth  | 25      | ₹1,999      | 199900        |
| Scale   | 100     | ₹4,999      | 499900        |

Packs are seeded into `credit_packs` table. Toggle `active=false` to hide without deleting.

---

## Database Schema

Three new tables. All changes via Drizzle migrations — no raw SQL.

### `credit_packs`
```ts
id          uuid PK default gen_random_uuid()
name        text not null
credits     integer not null
price_paise integer not null    // Razorpay works in paise
active      boolean not null default true
created_at  timestamp not null default now()
```

### `user_credits`
One row per user. Created on first report attempt (lazy init).
```ts
user_id        uuid PK FK→users(id) on delete cascade
balance        integer not null default 0
free_scan_used boolean not null default false
updated_at     timestamp not null default now()
```

### `credit_transactions`
Full audit log of every credit add and debit.
```ts
id                  uuid PK default gen_random_uuid()
user_id             uuid not null FK→users(id) on delete cascade
type                enum('purchase','debit') not null
amount              integer not null         // credits added or removed
pack_id             uuid nullable FK→credit_packs(id)
razorpay_order_id   text nullable
razorpay_payment_id text nullable
description         text not null
created_at          timestamp not null default now()
```

---

## API Endpoints

All under `/v1/billing`. All require authenticated session.

| Method | Path                   | Description |
|--------|------------------------|-------------|
| GET    | `/v1/billing/balance`      | Returns `{ balance, free_scan_used }` |
| GET    | `/v1/billing/packs`        | Returns active `CreditPack[]` |
| POST   | `/v1/billing/orders`       | Body: `{ pack_id }`. Creates Razorpay order. Returns `{ razorpay_order_id, amount, currency, key_id }` |
| POST   | `/v1/billing/verify`       | Body: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`. Verifies HMAC, credits user. |
| GET    | `/v1/billing/transactions` | Returns `CreditTransaction[]` purchase history |

### Paywall enforcement in `reports.service.ts`

Insert before job enqueue in `createReport()`:

```
1. Fetch or lazy-create user_credits row for current user
2. If free_scan_used = false:
     → allow scan
     → set free_scan_used = true (in same transaction as report insert)
3. Else if balance >= 1:
     → allow scan
     → deduct 1 from balance
     → insert credit_transactions row (type=debit)
4. Else:
     → throw PaymentRequiredError (HTTP 402)
     → no report row created
```

Deduction happens inside the same DB transaction as the report insert — atomic, no phantom scans.

### Razorpay order creation (`POST /v1/billing/orders`)

```
1. Validate pack_id exists and is active
2. Call Razorpay Orders API: POST https://api.razorpay.com/v1/orders
   { amount: pack.price_paise, currency: "INR", receipt: userId+packId }
3. Insert pending credit_transactions row (type=purchase, razorpay_order_id set, payment_id null)
4. Return { razorpay_order_id, amount, currency, key_id: RAZORPAY_KEY_ID }
```

### Razorpay payment verification (`POST /v1/billing/verify`)

```
1. Compute expected signature:
   HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
2. Compare with razorpay_signature — reject if mismatch (400)
3. Check transaction row exists for this order_id and belongs to current user
4. Update transaction: set razorpay_payment_id, mark complete
5. Add pack.credits to user_credits.balance (upsert)
6. Return { balance: newBalance }
```

---

## Frontend

### New route: `/billing`

- Shows credit balance badge + free scan status
- 3 pack cards (Starter / Growth / Scale) with buy button each
- Purchase history table (date, pack, credits, amount)
- Linked from dashboard sidebar nav

### Paywall modal

- Triggered when `POST /v1/reports` returns HTTP 402
- Message: "You've used your free scan. Buy credits to continue."
- Shows same 3 pack cards
- Flow on pack click:
  1. `POST /v1/billing/orders` → get Razorpay order
  2. Open Razorpay checkout popup
  3. On `payment.success` → `POST /v1/billing/verify`
  4. On verify success → close modal → auto-retry scan

### Razorpay checkout config

```js
{
  key: import.meta.env.VITE_RAZORPAY_KEY_ID,
  amount,           // from orders response
  currency,
  order_id,
  name: "RivalEye",
  description: "Credits pack",
  prefill: { email: currentUser.email },
  theme: { color: "#0061B1" },
  handler: (response) => verifyAndRetry(response)
}
```

---

## Environment Variables

| Variable              | Used by | Purpose |
|-----------------------|---------|---------|
| `RAZORPAY_KEY_ID`     | api     | Razorpay public key for order creation |
| `RAZORPAY_KEY_SECRET` | api     | Razorpay secret for HMAC verification — never sent to frontend |
| `VITE_RAZORPAY_KEY_ID`| web     | Public key passed to Razorpay checkout popup |

Add all three to `.env.example`.

---

## Out of Scope

- Refunds (handle manually via Razorpay dashboard for now)
- Subscription/recurring billing
- Invoice emails (Razorpay sends its own receipt)
- Admin credit grants (can be done via direct DB update for now)
