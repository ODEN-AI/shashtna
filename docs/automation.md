# Automation (phase 4)

Operational automation: reminders, follow-ups and alerts that are idempotent, observable and leave every
decision with a person. Step 1 (the core and the owner's daily list) is live, merged in PR #14 with its
migration on production. Step 2 (in-app customer reminders, below) is built and tested locally.

## The verdict (council, approved by the owner on 2026-10-31)

- The owner gets a **daily list**; customers are contacted only through **prefilled WhatsApp links the owner
  taps and sends himself** (`wa.me`). Nothing is sent from the owner's number automatically: no WhatsApp
  API, push, e-mail or SMS in this step.
- Activation, payment confirmation and reward approval are **never** automated.
- Everything ships **off**; a preview deploy never runs a job (previews share the production database).
- Order of work: step 1 the core and the daily list (this), step 2 in-app reminders for customers, step 3
  retries and a dead-letter view for failed sends.

## What step 1 does

| Piece | Where |
|---|---|
| Pure rules: run key, Baghdad day maths, which reminder is due, dedupe keys, quiet hours, where a job may run, Iraqi WhatsApp numbers, message templates, settings validation | `src/lib/automation.ts` |
| Token between the scheduled function and the site | `src/lib/automation-token.ts` |
| Database side: settings, the daily list, the outbox, the job runner | `src/server/automation.ts` |
| Scheduled function, 06:00 Baghdad (03:00 UTC) | `netlify/functions/daily-digest.mts` |
| Endpoint the function calls | `POST /api/automation/run` (`app/api/automation/run/route.ts`) |
| Admin page «اليوم» | `/admin/today` (`app/admin/today/`) |
| Settings card | Admin → Settings → الأتمتة (`#automation`) |

### Tables (migration `20261031T1006_automation_core`, additive only)

- `automationRun`: one row per job run. `runKey` is unique (`daily-digest:YYYY-MM-DD`, Baghdad day);
  `status` RUNNING / SUCCEEDED / FAILED; `trigger` SCHEDULE / MANUAL; `stats` (JSON counts only); `error`
  (the error text, never customer data).
- `outboxMessage`: one row per message. `dedupeKey` is unique (`wa:{template}:{subscriptionId}:{endDate}`);
  `channel` WHATSAPP_LINK; `status` SENT, or SKIPPED in dry run; `sentBy` the owner; `payload` holds only the
  subscription id and end date (no phone number, no credentials). `attempts` and `nextAttemptAt` are there
  for step 3.

### Settings (all off by default, owner-only to change)

| Key | Default | Meaning |
|---|---|---|
| `automation.enabled` | off | Master switch |
| `automation.job.dailyDigest` | off | The morning job |
| `automation.dryRun` | off | Runs and records, but sends no notification and marks links SKIPPED |
| `automation.quietHours` | `22:00-09:00` | Baghdad time; the page flags «وقت راحة» inside it |

### The daily list (computed live on every view)

- **Subscriptions** (IPTV, VIP, DIGITAL; not suspended or cancelled) whose end date is exactly 5 days
  away (`before-expiry`), today (`expiry-day`) or 3 days ago (`win-back`), in Baghdad calendar days.
- **Orders**: SUBMITTED / AWAITING_PAYMENT older than 24 hours without a proof; proofs awaiting review;
  PAID / FULFILLING not completed after 12 hours.
- **Health**: completed site orders with no cost since the first credit purchase; loyalty balances off
  the ledger; completed orders missing their points; the last morning run and its status.

Each subscription row has a WhatsApp button (owner only) with a prefilled Iraqi Arabic message: first name,
the subscription and its end date, points when above 0, an active renewal discount, and the renewal link
`/checkout?renew=<id>`. Opening it records the outbox row once (`ON CONFLICT DO NOTHING`) and the row shows
«أُرسلت». A stored phone that is not an Iraqi mobile (`9647…` after normalising) gets no link. Staff with
the `orders` permission see the list read-only.

### The job and its guards

Scheduled path: Netlify runs `daily-digest` only on published production deploys; the function exits unless
`CONTEXT === "production"`, then calls `/api/automation/run` with `Authorization: Bearer <HMAC-SHA256 of
"automation:<runKey>" keyed by AUTH_SECRET>` (no new secret). The endpoint checks the token (one job, one
day), then `runJob`:

1. Manual runs: full access only.
2. `canRunHere`: production `CONTEXT`, or a local database (`localhost` / `127.0.0.1`).
3. `automation.enabled` and the job switch.
4. `pg_try_advisory_xact_lock(hashtext('automation:<job>'))`; busy → SKIPPED.
5. Insert the `automationRun` row by `runKey` **before** any work; a conflict → SKIPPED (DUPLICATE).
6. Work: count the list, notify every full-access user once (`dedupeKey daily-digest:{day}:{userId}`;
   none in dry run), store the counts, log `AUTOMATION_RUN` (or `AUTOMATION_RUN_FAILED`) to the activity log.

A failed run stays claimed for that day (no automatic retry in step 1); the page shows it under Health.
«شغّل هسه» on the page runs the same path for the owner and is disabled once today has run.

## Step 2: in-app customer reminders

Status: built and tested locally on `feat/customer-reminders`; not on production. Ships **off**
(`automation.job.customerReminders`).

| Piece | Where |
|---|---|
| Pure rules: `reminderDedupeKey`, `renderInAppReminder` (Arabic first, English twin), `reminderLink`, `reminderRef`, `reminderSkip`, `reminderConversion` | `src/lib/automation.ts` |
| Job `customer-reminders`, `linkReminderToOrder`, `reminderReport`, `customerRemindersOn` | `src/server/automation.ts` |
| Order column `subscriptionRequest.reminderOutboxId` (migration `20261031T1123_customer_reminders`, additive) | `src/prisma/contract.prisma` |
| Checkout carries `?r=` into the order | `app/(site)/checkout/CheckoutForm.tsx`, `actions.ts` |
| «اليوم»: «أرسل تذكيرات العملاء» (owner) and the 30 / 90-day card | `app/admin/today/` |

**The job** runs under the same guards as step 1 (production or local database, master switch, its own
switch, advisory lock, one run key per Baghdad day), called by the same scheduled function after the
daily list. For every IPTV, VIP and DIGITAL subscription (CODE deliveries have none) that ends in exactly
5 days (`before-expiry`), today (`expiry-day`) or ended 3 days ago (`win-back`):

1. Skip it when the subscription is suspended or cancelled, or the customer turned renewal reminders off
   (`user.renewalReminders`, Account settings). A renewal extends the same subscription, so a renewed one
   simply isn't due (its end date moved); a customer's other subscription never silences this one.
2. Insert the outbox row first: `channel IN_APP`, `dedupeKey reminder:{template}:{subId}:{endDate}`
   (`ON CONFLICT DO NOTHING`). Already there → nothing else happens, so a repeat never sends twice. A new
   end date (a renewal) is a new key, which re-arms the next cycle by itself.
3. Create the customer's notification (same dedupe key) and mark the row SENT. The link opens the renewal
   checkout for that subscription and the length it was last bought or renewed with
   (`/checkout?renew={subId}&option={optionId}&r={outboxId}`), or the customer's open unpaid renewal order
   of that subscription (`/orders/{id}`) when there is one. The text names the subscription and end date,
   adds the points balance when the program is on and the balance is above 0, and an active renewal
   discount on that length.
4. The row's payload keeps the whole event for push later (template, link, both languages,
   `pushEligible: true`); never a phone number or credentials.

**Dry run** writes SKIPPED rows under a per-day `dryrun:` key and creates nothing for customers, so a dry-run
morning never blocks that cycle's real reminder.

**Quiet hours:** in-app notifications are silent, so creating them at 06:00 is fine. Push (Chapter 2) must
respect `automation.quietHours`.

**On-visit reminders:** while this job is on, the dashboard's older on-visit reminders
(`ensureRenewalReminders`) stay quiet so a customer never gets both.

**Measurement.** A RENEW order placed from a reminder link stores `reminderOutboxId` (`linkReminderToOrder`).
It is accepted only for an IN_APP reminder that was SENT to the same customer for the order's subscription,
and only once; a forged or stale `r` is ignored and never blocks the order. «اليوم» shows, for the last 30
or 90 days: reminders sent per template, renewals started and completed from a reminder, conversion
(completed ÷ sent) and site renewals completed without a reminder. Counts only; nothing reaches logs or the
AI analyst.

Not in step 2: the mobile app's checkout does not pass `r` yet; retries for a PENDING row whose
notification failed come with step 3.

## Tests

| Kind | Where |
|---|---|
| Unit: day maths across month and year ends, reminders, dedupe keys, quiet hours, `canRunHere`, phone normalising, templates, settings, token, the function's guard and schedule | `tests/automation.test.ts` |
| Integration (local DB): switches, the list, one run per day (repeat and parallel), one notification, SENT once, owner-only, dry run, a failing run | `scripts/integration/automation.mts` |
| Unit (step 2): T-5 / T-0 / T+3 across month end, skip rules, re-arming after a renewal, text with points and discount, links, `?r=` parsing, conversion | `tests/automation.test.ts` |
| Integration (step 2, local DB): switch, dry run creates nothing and doesn't block, the right notifications once, repeat no-op, open order link, tracking and forged `r`, measurement | `scripts/integration/customer-reminders.mts` |

## Deploy order

Step 2: apply `20261031T1123_customer_reminders` to production (owner approval; one additive column) → merge
→ turn on «تذكير العملاء داخل الموقع» with dry run on → check the run under «اليوم» → dry run off.

Step 1 (done):

1. Apply `20261031T1006_automation_core` to production (owner approval; additive, no data step).
2. Merge. The scheduled function is registered on the production deploy; it does nothing while
   `automation.enabled` is off.
3. Open «اليوم», check the list; turn on dry run + the job + automation; next morning check the run under
   Health; then turn dry run off.
