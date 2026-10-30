# Real costs and supplier orders

Profit figures use real costs. Every completed order stores what it cost, at the moment it completed.

## Panel credit (site and direct orders)

The owner activates site and direct orders from his panel with prepaid credit. He buys the credit in USD and pays in IQD.

- **Credit purchases.** Admin → Finance → Panel credit (`/admin/finance/credits`), owner only. Each purchase records the date, the credit in USD (stored as whole cents), the IQD paid (whole dinars) and a note. The table is append-only.
- **Rate.** The latest purchase sets the current rate (IQD paid ÷ credit dollars). Example: $200 for 180,000 IQD is 900 IQD per credit dollar. The page shows the rate history.
- **Credit per length.** Set it per option in the package form ("كلفة الرصيد ($)", stored as `packageOption.creditCostCents`; 100 = $1). Empty means unknown. VIP lengths keep their own value, never IPTV's.
- **Snapshot.** When an order completes, `completeOrderWithSubscription` stores three fields on the order:
  - `creditCostCents`, the option's credit;
  - `creditCostIqd`, that credit at the current rate, rounded to the dinar;
  - `creditPurchaseId`, the purchase whose rate was used.

  A later purchase or credit edit never changes a past order.
- **Unknown cost.** If the length has no credit set or no purchase is recorded, the cost stays `null`. It shows as «تكلفة غير معروفة» and is never counted as zero. Orders completed before this feature have no backfill (owner decision, 2026-10-31).

## Supplier orders

A customer who comes through the supplier pays the owner by chat. The supplier makes the subscription from his own panel, so the owner spends no credit.

- **Where.** Customer 360 → «تسجيل اشتراك عن طريق المورّد». Owner only.
- **Form.** Defaults: 2 years, 15,000 IQD, supplier share 10,000. It creates a new IPTV subscription, or renews one of the customer's IPTV subscriptions.
- **What gets saved.** One transaction (`src/server/supplier-orders.ts`) creates:
  - a `COMPLETED` order with `channel = "SUPPLIER"`, `supplierShareIqd` and a known credit cost of 0;
  - the subscription, with expiry calculated like a normal activation;
  - a receipt.

  Expiry, renewal reminders and support then work as for any subscription. The credentials stay masked; revealing them is the existing audited endpoint.
- **Accounts.** Only customers who already have an account (signed up on the site or app) can get a supplier order. Admin can't create accounts (owner decision, 2026-10-31).
- **No loyalty points.** `earnBlock` returns `SUPPLIER`, so neither `awardForOrder` nor `missingAwards` counts these orders, and the launch seed ignores them.

## Finance

The Admin → Finance table «الكلفة الحقيقية وصافي الربح» shows these columns for each channel (site and direct, supplier) and in total:

- revenue;
- credit cost;
- supplier share;
- net profit (revenue − credit cost − supplier share).

Net profit covers only sales whose cost is known. Sales with an unknown cost are listed with their count and revenue.

The AI analyst fact pack gets the same aggregates (`costOfSales`) and no customer data.

## Where

| | |
|---|---|
| Pure rules (unit-tested) | `src/lib/costs.ts`, `tests/costs.test.ts` |
| Database side | `src/server/costs.ts`, `src/server/supplier-orders.ts` |
| Finance | `src/lib/finance.ts` (`recognizeSales`, `costProfit`), `src/server/finance.ts`, `app/admin/finance/page.tsx` |
| Integration (local DB) | `scripts/integration/costs.mts` |
| Migration | `20261030T2329_real_costs` (additive) |
