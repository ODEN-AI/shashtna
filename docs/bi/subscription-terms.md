# Phase 6, step 2 — subscription terms

A renewal moves the same subscription's expiry, so the subscription row has no history. Renewal rate, churn and
retention (step 3) need one: **a term is one paid period** — every activation and every renewal.

## Data

Table `subscriptionTerm` (migration `20261113T1517_subscription_terms`, additive): `subscriptionId`, `userId`,
`serviceType`, `kind` (NEW | RENEW), `startsOn` / `endsOn` (Baghdad dates, YYYY-MM-DD), `months`, `receiptId`
(**unique**: one term per receipt, never twice), `orderId`, `source` (ACTIVATION | BACKFILL), `matchesExpiry`,
`createdAt`. Append-only: nothing updates or deletes terms.

## How terms are written

**At activation (from now on).** Right after each activation or renewal writes its receipt, `recordTerm` stores the
term with the exact dates that activation used:

| Path | Where |
|---|---|
| Site activation and renewal of an order | `app/api/admin/subscriptions/route.ts` (POST) |
| Supplier orders | `src/server/supplier-orders.ts` (after the transaction commits) |
| Digital platforms | `src/server/platform-orders.ts` (after the transaction commits) |

It is **best effort**: a failure is logged (`SUBSCRIPTION_TERM_ERROR`) and never fails the activation; the
backfill fills any receipt without a term.

**Backfill (once, then any time).** `scripts/bi/backfill-terms.mts` replays each subscription's receipts with the
activation rule (first term from the stored start date; a renewal extends the running expiry, or starts on the
receipt's Baghdad day if the subscription had ended) and adds the terms of receipts that have none. Without
`--apply` it only reads and prints counts; with `--apply` it writes `subscriptionTerm` rows only. Idempotent. A
subscription whose replay doesn't end within 7 days of its stored expiry (a manual edit) gets its terms with
`matchesExpiry = false`, so step 3 can leave them out.

Manual edits from the subscription page (`PATCH`) change dates without a receipt and write no term.

## Running the backfill on production

Needs the owner's approval, and the migration applied first (the deploy order below). The owner runs, with
`DATABASE_URL` set to the production link in that shell:

```
node --experimental-strip-types --import ./tests/register-alias.mjs scripts/bi/backfill-terms.mts
node --experimental-strip-types --import ./tests/register-alias.mjs scripts/bi/backfill-terms.mts --apply
```

Expected from the 2026-11-13 audit: about 63 terms, 60 matching and 3 flagged. **Done on production 2026-11-13** (by the owner, before the merge): 63 terms added, 60 matching, 3 flagged. After the merge, run it once more (check, then `--apply` if it plans anything) to catch activations made in between.

## Code

| File | Holds |
|---|---|
| `src/lib/subscription-terms.ts` | `termsFromReceipts`, `replayMatches`, `planBackfill`, `checkTerm` — `tests/subscription-terms.test.ts`; `src/lib/bi-audit.ts` now uses the same replay |
| `src/server/subscription-terms.ts` | `recordTerm`, `backfillTerms` |
| `scripts/bi/backfill-terms.mts` | The backfill (check / `--apply`) |
| `scripts/integration/subscription-terms.mts` | Local-database check |

## Deploy order

The activation paths write `subscriptionTerm`, but only best effort, so publishing before the migration would not
break activations; it would just log errors and record nothing. Still: **apply migration
`20261113T1517_subscription_terms` to production first (owner approval), then merge, then run the backfill.**
