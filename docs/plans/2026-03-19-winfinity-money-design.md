# Winfinity Money — Design Document

## Overview

Minimalist INR → Crypto deposit app. Lives inside the client codebase as a route group, served via subdomain `money.winfinity.com`.

## User Flow

1. **Sign In** — Privy auth (sign-in only). User must already exist in DB (from client app). No sign-up.
2. **Deposit Screen** — Enter INR amount, select crypto (ETH/USDT), see conversion at admin-set rate. Hit "Start Deposit".
3. **Payment Screen** (5-min countdown):
   - Bank details displayed (from env vars)
   - User's referral code shown as the **remark** to include in bank transfer
   - Countdown timer (5 minutes)
   - UTR input field — user enters UTR after sending payment
   - "Submit UTR" confirms → transaction stays `pending` for admin review
   - Timer expiry without UTR → transaction auto-cancelled (`failed`)
4. **Done** — User sees pending status. Admin reviews and approves/rejects.

## Admin Panel

Protected routes (requires `role: admin` in DB).

### Dashboard
- Total pending transactions
- Total completed today
- Total INR volume

### Transactions List
- User name/email, INR amount, crypto amount + token, UTR, referral code (remark), status, timestamp
- Actions: Approve (`completed`) / Reject (`failed`) for pending transactions

### Rate Settings
- Set ETH rate (INR per ETH)
- Set USDT rate (INR per USDT)
- Stored in `wm_exchange_rates` table

## Architecture

### Routing
- Route group: `app/(winfinity-money)/`
- Middleware rewrites `money.winfinity.com` → `/winfinity-money/*`
- Own layout with minimal branding, separate from client app

### Routes
```
(winfinity-money)/
├── layout.tsx                    # Minimal branded layout
├── page.tsx                      # Login/landing
├── deposit/
│   └── page.tsx                  # Amount + crypto selection
├── payment/
│   └── [transactionId]/
│       └── page.tsx              # Timer + bank details + UTR input
├── admin/
│   ├── page.tsx                  # Dashboard + transactions list
│   └── rates/
│       └── page.tsx              # Set ETH/USDT rates
```

### Database

**New table (prefixed `wm_`):**

```prisma
model WmExchangeRate {
  id        String   @id @default("default")
  ethRate   Decimal  @map("eth_rate") @db.Decimal(18, 2)
  usdtRate  Decimal  @map("usdt_rate") @db.Decimal(18, 2)
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("wm_exchange_rates")
}
```

**Existing tables used:**
- `users` — auth, role check
- `profiles` — referral code as payment remark
- `transactions` — deposit records
  - `metadata` JSON stores: `{ utr, remark, expiresAt }`
  - `type`: `deposit`
  - `token`: `ETH` or `USDT`

### Auth
- Same Privy app ID as client
- Sign-in only: after Privy login, check `users` table — reject if not found
- Admin routes: check `user.role === 'admin'`

### Auto-Cancel Logic
- On transaction creation, set `metadata.expiresAt` = now + 5 minutes
- Client-side timer counts down
- API endpoint to submit UTR checks if transaction has expired before accepting
- Cron job or on-demand check marks expired pending transactions as `failed`

### Subdomain Setup (Vercel)
- Add `money.winfinity.com` as a domain in Vercel
- Middleware detects hostname and rewrites paths
