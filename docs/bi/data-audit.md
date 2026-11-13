# Phase 6, step 1 — subscription-history data audit

Phase 6 (business intelligence) needs a history of subscription terms: renewal rate, churn, retention and
customer value all depend on it. The site keeps none: a renewal moves the same subscription's expiry. The
Intelligence pages say so ("نسبة التجديد غير متاحة…", "قيمة العميل مدى الحياة (CLV) غير محسوبة…").

Every activation and renewal writes a **receipt** (site activation and renewal in
`app/api/admin/subscriptions/route.ts`, supplier orders in `src/server/supplier-orders.ts`, digital platforms in
`src/server/platform-orders.ts`) with the subscription id, the term length (bonus months included) and the date.
This audit measures how far those receipts can rebuild the history.

## How it measures

For each subscription, replay its receipts in date order with the activation rule (`replayExpiry`):

- the first term starts on the stored start date;
- a renewal extends the running expiry, or starts on the receipt's Baghdad day if the subscription had ended
  (staff may pick another renewal date; up to 7 days of difference counts as "close").

Then compare the result with the stored expiry: **exact**, **close** (≤ 7 days) or **off**. "Off" or "no receipts"
usually means a manual edit (`SUBSCRIPTION_UPDATED`) or a subscription from before receipts existed.

Coverage = (exact + close) ÷ all subscriptions. Verdict for step 2:

| Verdict | Coverage | Step 2 then |
|---|---|---|
| `FULL` | ≥ 90% | Rebuild the history from receipts for every matching subscription |
| `PARTIAL` | 50–90% | Rebuild where it matches; the rest is marked «تاريخ غير مكتمل» and left out of rates |
| `FORWARD_ONLY` | < 50% | Record terms from now on; past renewals stay out of the rates |

It also counts completed orders without a subscription or a receipt, supplier and reward orders, receipts without an
order or for a missing subscription, customers with several subscriptions of one service (bought again instead of
renewed), and manual edits.

## Privacy and safety

Read-only: it reads only the columns it needs (never usernames, passwords, MAC, device ids, names, phones, proofs or
notes) and writes nothing. The output is counts, percentages and months only — no names, phones or ids. Only the
database host is printed, never the connection string.

## Running it

Production access needs the owner's approval; the owner runs it:

```
node --experimental-strip-types --import ./tests/register-alias.mjs scripts/bi/audit.mts
```

with `DATABASE_URL` set to the production link in that shell. Paste back the summary lines (from
«فحص بيانات الاشتراكات») — not the line that sets the link.

## Code

| File | Holds |
|---|---|
| `src/lib/bi-audit.ts` | `replayExpiry`, `daysBetween`, `buildAudit`, `auditVerdict` — `tests/bi-audit.test.ts` |
| `scripts/bi/audit.mts` | Reads the rows and prints the summary (Arabic) and the JSON result |

## Results

| Date | Database | Result |
|---|---|---|
| 2026-11-13 | local dev database (3 test subscriptions) | Script runs; `FORWARD_ONLY` (test data only, not meaningful) |
| 2026-11-13 | **production** (run by the owner) | **`FULL`**, coverage 92.3% — see below |

### Production, 2026-11-13

- 65 subscriptions, **all IPTV** (no VIP or DIGITAL yet), created 2026-09 to 2026-11; 1 has expired so far; 3 customers
  hold more than one IPTV subscription.
- 63 receipts (52 linked to an order, 11 without — direct staff activations), none for a missing subscription.
- History: 63 subscriptions with receipts, 2 without; **every subscription has exactly one receipt**; replay exact for
  60, off for 3; 2 manual edits on 2 subscriptions.
- 52 completed orders, **all NEW** — no renewal has happened yet; no supplier or reward orders; none without a
  subscription or a receipt.

**What it means.** The receipts are a reliable history (step 2 can rebuild it), but the business is young: almost
no term has ended, so renewal rate, churn and retention have nothing to measure yet. They become meaningful as the
first terms end (3-month packages bought in September end in December). Revenue, profit per package and value per
customer can be measured now.
