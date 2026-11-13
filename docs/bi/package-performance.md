# Phase 6, step 5 — package performance

Admin → Intelligence → Products (`/admin/intelligence/products`), section **«الربح حسب الباقة والمدة (للمالية فقط)»**.
Roles with `finance` only: the numbers are never computed for other roles. The step order was changed with the
owner on 2026-11-13 (step 5 first, because no renewal has happened yet; see `docs/bi/data-audit.md`).

## What it shows

For completed sales in the selected period, from the same sales engine as Finance (`recognizeSales`), one row per
**package and length** (3 months, 1 year…):

| Column | Meaning |
|---|---|
| Sales, revenue, average price | What was charged, already net of discounts |
| Cost | Credit cost + supplier share, on sales whose cost is known |
| Profit (margin %) | Revenue − credit cost − supplier share, **known-cost sales only**; margin = profit ÷ their revenue |
| Unknown cost | Sales without a cost snapshot («تكلفة غير معروفة»): never counted as zero |
| Discount | Discount given and on how many sales |

Tiles: profit on known costs (with the change against the previous period of the same length), margin, the most
profitable package (only a clear leader: at least 2 known-cost sales and no tie) and the count and revenue of
sales with an unknown cost (links to «رصيد اللوحة», where costs are recorded). When no sale in the period has a
known cost, profit and margin say «غير معروف», not 0.

Rules kept: loyalty rewards are never sales; a VIP device line is not package revenue; IPTV and VIP are separate
rows; nothing is estimated.

## Code

| File | Holds |
|---|---|
| `src/lib/package-performance.ts` | `packagePerformance` (rows by package and length, plus the total), `mostProfitable` — `tests/package-performance.test.ts` |
| `src/lib/finance.ts` | Sale lines now carry `durationMonths` (from the order, or the receipt for receipt-only sales) |
| `src/server/finance.ts` | `getPackagePerformance(selection)`; `durationMonths` read from orders and receipts |
| `app/admin/intelligence/products/page.tsx` | The section (finance only) |

## Not yet

Renewal rate per package needs renewals; it comes with step 3 (December, when the first terms end).
