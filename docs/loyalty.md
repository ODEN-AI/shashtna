# «نقاط شاشتنا» — loyalty points

A retention program for existing IPTV customers: paid IPTV orders earn points,
and points buy a free renewal. The program **ships disabled** and every number
is an owner setting (Admin → Settings → نقاط شاشتنا).

| Setting | Default | Meaning |
|---|---|---|
| `loyalty.enabled` | `off` | Off: no earning, no redemption, no customer UI (admin pages stay) |
| `loyalty.reward3mPoints` / `reward6mPoints` | 30 / 60 | Cost of 3 / 6 free months |
| `loyalty.reward3mOptionId` / `reward6mOptionId` | — | The active IPTV package option each reward renews with (required to redeem) |
| `loyalty.pendingDays` | 7 | Days after completion before points can be spent |
| `loyalty.expiryMonths` | 6 | The balance expires this long after the latest IPTV subscription expiry |
| `loyalty.cooldownDays` | 90 | One redemption per period |
| `loyalty.seedPoints` | 10 | One-time launch gift |

## Rules

- **Earn:** IPTV `NEW` / `RENEW` / `UPGRADE`, price > 0, reaching `COMPLETED`, while the program is on:
  `floor(price / 1000)` from the price stored on the order, or the option's `pointsEarned`
  (Admin → Catalogue, per length; empty = automatic). Never devices, VIP or reward orders. No backfill.
- **Redeem:** `redeemReward` takes the points with one conditional `UPDATE` (available points, no open
  reward, cooldown over, account active) and, in the same transaction, creates the reward order
  (`RENEW`, price 0, `loyaltyReward = true`, `SUBMITTED`, the chosen IPTV subscription) and the
  `REDEEM` entry. Two simultaneous redemptions: exactly one succeeds.
- **Approve / activate:** the owner moves the reward to `PAID` (no proof, no payment step). Staff then
  activate it as a normal renewal; the activation endpoint accepts it only after approval, at price 0
  and the reward's length. A rejection or cancellation before completion returns the points
  (`REDEEM_RETURN`); the customer can cancel only before approval.
- **Corrections:** the owner can `REVERSE` an order's points or `ADJUST` a balance, with a reason. A
  balance may go negative: that blocks redemption, nothing is ever charged.
- **Ledger:** `loyaltyEntry` rows are never updated or deleted; each has a unique idempotency key
  (`seed:user:{id}`, `earn:order:{id}`, `redeem:order:{id}`, `redeem-return:order:{id}`,
  `reverse:order:{id}`, `expire:user:{id}:{date}`, `adjust:{uuid}`) and a JSON snapshot of the rules it
  used. `loyaltyAccount.balance` equals the sum of the entries (Admin → Shashtna Points → reconciliation).
- **Finance:** reward orders are not revenue, sales, AOV or product rows; Admin → Shashtna Points
  reports points issued / redeemed / expired / reversed, reward cost and outstanding liability
  (points ÷ `reward3mPoints` × $1).

## Where

| | |
|---|---|
| Pure rules (unit-tested) | `src/lib/loyalty.ts`, `tests/loyalty.test.ts` |
| Database side | `src/server/loyalty.ts` |
| Hooks | `completeOrderWithSubscription` → `awardForOrder`; `updateOrderStatus` / `cancelOrderByCustomer` → `returnReward` (`src/server/orders.ts`); reward guard in `app/api/admin/subscriptions/route.ts` |
| Customer | `/points`, dashboard card, order page and receipt line, plan / checkout line |
| Admin | `/admin/loyalty` (report, owner queue, reconciliation), Settings card, package form, Customer 360, order page (reverse) |
| App | `GET /api/mobile/loyalty`, `POST /api/mobile/loyalty/redeem` (`docs/mobile-api.md`) |
| Seed | `node --experimental-strip-types scripts/loyalty/seed.mjs [--check]` (local only unless the owner approves a production run) |
| E2E | `scripts/e2e/loyalty.mjs` (local database and server) |

## Deploy order

1. Owner approves, then apply migration `20261030T1747_loyalty_points` to production (additive).
2. Publish the code (the program is off).
3. `seed.mjs --check` against production (owner approval) and review the counts.
4. Run the seed (owner approval).
5. Pick the reward lengths, then turn the program on in Admin → Settings.
