# Phase 6, step 4 — customer value

Admin → Intelligence → Customers (`/admin/intelligence/customers`), section **«قيمة العملاء (للمالية فقط)»**. Roles
with `finance` only: never computed for other roles. All time (not tied to the page's period).

## What it shows

Everything is **what customers actually paid**, from the same sales engine as Finance. Nothing is projected:
projected lifetime value (CLV) stays uncomputed, and renewal and churn rates wait until enough terms end
(`docs/bi/data-audit.md`).

| Part | Meaning |
|---|---|
| Paying customers | Customers with at least one paid sale, and how many have a subscription running now (active or expiring) |
| Average / median paid | Total paid ÷ paying customers; the median is less pulled by a few big buyers |
| Top 20% revenue share | How much of all revenue the top fifth of customers brought |
| Bought more than once | A renewal or a second purchase |
| Tiers | Customers ranked by total paid: top 20% «الأعلى قيمة», next 30% «متوسطة», the rest «أساسية» — relative, explainable, no scores |
| By month of first purchase | Customers per first-purchase month: how many, paid so far, running now, bought again |
| Highest-value customers | The top 15 by total paid, with purchases, first purchase and whether a subscription is running; each links to the customer |

Rules: staff accounts (owner and test purchases) and loyalty rewards are left out. The page's older figure
«متوسط ما دفعه العميل منذ البداية» (in «القيمة المالية») still includes every buyer, staff too, so it can differ
slightly.

## Code

| File | Holds |
|---|---|
| `src/lib/customer-value.ts` | `customerValue` (per-customer totals, tiers, cohorts, summary), `TIER_SHARES` — `tests/customer-value.test.ts` |
| `src/server/finance.ts` | `getCustomerValue(top)`: staff ids and running subscriptions from the finance sources; names only for the top rows |
| `app/admin/intelligence/customers/page.tsx` | The section (finance only); the «غير متاح» notes now say what is shown instead |
