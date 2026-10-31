# Shashtna — progress, decisions and next steps

The single source of truth for project status. Read it at the start of every task, and update it before
calling a task done (rule in `CLAUDE.md` → "Progress tracking"). Detailed reports live in `docs/<area>/`;
this file links to them instead of copying them.

Status marks: ✅ done (with evidence) · 🔄 in progress · ⏳ planned · ⏸️ paused · ❓ needs verification.

## Status now (2026-10-31)

- **Production** runs `main` at `11b5299` (PRs #6–#12 merged; checked with `git log origin/main`). The owner
  checked the live site after the deploys: it works.
- **Production database** marker `eb9bf30b7888` with the latest migration `20261031T0021_discounts`
  (reported by the planning session after the owner-approved apply; not re-read here). ❓
- **«نقاط شاشتنا» (loyalty points)** is **live** (switched on by the owner 2026-10-31). Reward options are set
  (Star10 3 months / 6 months). The launch seed ran on 2026-10-31: 40 customers × 10 points = 400 points.
- **Deploy Previews use production** (database, `AUTH_SECRET`, Blobs; an owner decision recorded in
  PR #6). Treat any preview as production.

## Roadmap

Long-term direction, in order. A phase is marked done only with evidence.

| # | Phase | Status | Evidence / notes |
|---|---|---|---|
| 1 | Stabilize the foundation (site, data, orders, payments, activation, deploys) | ✅ | Schema and code in sync on production (marker `0395c5c66aa0`). Open: see "Known risks" |
| 2 | Reliable business data (customers, subscriptions, orders, payments, supplier costs, events) | ✅ | Real costs live (PR #9 + #10, migration `20261030T2329_real_costs` applied 2026-10-31, marker `76e80bbd5844`); data audit 2026-10-31 clean apart from accepted owner/test items — `docs/costs.md` |
| 3 | Complete the customer and admin experience | 🔄 | Redesign (PR #6) ✅; loyalty (PR #7) ✅ live since 2026-10-31; discounts (PR #12) ✅ merged; plan groups and digital platforms built on `feat/plan-groups` (PR open, migrations `20261031T0738_plan_groups` + `20261031T0742_platform_account_email` not on production) — `docs/plan-groups.md` |
| 4 | Operational automation (reminders, follow-ups, alerts; idempotent, observable, human approval) | ⏳ | — |
| 5 | SHASHTNA AI CORE and agents (Customer, Operations, Finance, Marketing) with scoped tools | ⏳ | An AI business analyst exists (aggregates only) |
| 6 | Business intelligence and data-driven growth | ⏳ | Finance/BI dashboard exists (PR #4) |
| 7 | Integrated AI-powered operations, desktop and mobile admin clients on the shared backend | ⏳ | Android console shell exists (`shells/mobile`) |

## In progress

| Item | Status | Where |
|---|---|---|
| Launch «نقاط شاشتنا»: reward options ✅ → `seed --check` ✅ → seed ✅ (40 customers, 400 points) → owner enables ✅ (2026-10-31) → announcement ⏳ | 🔄 | Admin → Settings → نقاط شاشتنا; `scripts/loyalty/`; `docs/loyalty.md` |
| Progress documentation (this file and the `CLAUDE.md` rule) | ✅ | PR #8 merged |
| Real costs and supplier orders (phase 2) | ✅ | PR #9 + PR #10 merged; production marker `76e80bbd5844` |
| Discounts (phase 3, part 2) | ✅ | PR #12 merged (`11b5299`) |
| Plan groups and digital platforms (phase 3, part 3): owner-managed groups on /plans (colours with a contrast check, logo, delivery CODE / ACCOUNT / CUSTOMER_EMAIL), DIGITAL service, checkout e-mail, staff fulfilment with masked / audited codes, platform points, fixed IQD cost | 🔄 built and tested locally; waiting for review, the production migrations and merge | `feat/plan-groups`; `docs/plan-groups.md` |

## Known risks

- **Accepted by the owner (2026-10-31), kept as known risks:** the production database password was shared in
  a chat on 2026-10-30 and has not been rotated; Deploy Previews write to production.
- **`scripts/db/production-migrate.mjs` does not run on Windows:** the entry check
  (`import.meta.url === file://${argv[1]}`) never matches, and `node_modules/.bin/prisma` needs
  `prisma.cmd`. On Netlify (Linux) it is fine. The 2026-10-30 loyalty migration was applied by hand with
  the same steps (`db migrate --show`, `--to <tip>`, `db verify`). ⏳
- ❓ Whether a merge to `main` publishes automatically (both merges on 2026-10-30 went live, per the owner;
  the Netlify setting itself is unverified).
- Two e2e scripts need `psql`, which is not installed on the owner's machine, so they did not run for
  PR #6 / PR #7 / `feat/real-costs` / `feat/discounts`.
- Platform groups: the home page rail stays IPTV / VIP; the /plans intro still says "two services" (customer
  copy, needs the owner's wording); a built-in group's stored colours are not drawn (IPTV / VIP keep their own
  design) and must pass the contrast check if the owner edits that group. ⏳
- Device (VIP hardware) discounts are deferred (owner, 2026-10-31): a VIP discount covers the package
  price only. The home-page VIP section and the stage's "from" prices show list prices; the plan pages,
  checkout and the order charge the discounted price. ⏳
- `tests/domain.test.ts` "subscription state is derived from expiry" fails between 00:00 and 03:00
  Baghdad time: the test builds "today" from the UTC date while expiry is read in local time. It passes
  with `TZ=UTC`. Not caused by recent work; fix it in its own change. ⏳
- Costs are only real for orders completed after the owner records a credit purchase and the credit per
  length; earlier orders stay «تكلفة غير معروفة» (no backfill, by decision).

## Next step

Review the plan-groups PR. Then, with the owner's approval: apply `20261031T0738_plan_groups` and
`20261031T0742_platform_account_email` to production → merge (code; /plans looks the same until a platform
group exists) → add a platform from Admin → Catalogue → «المجموعات والمنصات» and its packages. That closes
phase 3.

## Chapter 2 (after the 7 phases)

Rebuild the Shashtna apps (the site's customer app, Shashtna Player, Shashtna Player Lite) and connect them
to the site. Site notifications reach all apps; packages, renewals and subscription follow-up stay in the
site's customer app. ⏳

## Decisions

Newest first. Details are in the linked documents.

| Date | Decision | Why |
|---|---|---|
| 2026-10-31 | Plan groups: no new page — groups are sections of /plans, managed in the dashboard (colours as data, contrast-checked); each subscription type is its own package inside a group; one `DIGITAL` service for every platform (the group keeps platforms apart); ACCOUNT / CUSTOMER_EMAIL purchases are subscriptions that renew within their group, a CODE is one-off; platforms earn 1 point per 5,000 IQD and never redeem rewards | Owner (brief + answers in chat) |
| 2026-10-31 | Discounts: per package option; percent 1–90 or fixed IQD, rounded down; NEW and UPGRADE always, renewals only when ticked; at most one active per option; reward and supplier orders never discounted; device discounts deferred | Owner (discount brief; devices later) |
| 2026-10-31 | Audit findings accepted as-is: 8 IPTV lengths (+1 VIP) come from the owner's father's panel, profit split 50/50, and are not tracked in the dashboard, so their cost stays «تكلفة غير معروفة»; one expired "test" subscription, two customers with several active subscriptions and two duplicate phone numbers are deliberate test/owner accounts; old receipts/subscriptions without links are legacy | Owner: keep the dashboard simple |
| 2026-10-31 | Phase 2 closed | Real costs live; audit clean apart from the accepted items above |
| 2026-10-31 | "Owner only" means full access (`OWNER` or legacy `ADMIN`), matching `src/lib/roles.ts` | The owner's own account is `ADMIN` ("مدير (كامل الصلاحيات)") and cannot change its own role |
| 2026-10-31 | Supplier orders only for customers who already have an account; the admin cannot create accounts | Owner (no new account path for now) |
| 2026-10-31 | No estimated cost backfill for old orders: they stay «تكلفة غير معروفة» and are reported separately | Owner: every cost figure must be a recorded one |
| 2026-10-31 | Costs are snapshotted on the order at completion (credit cents, IQD at the latest purchase's rate, the purchase used); credit purchases are append-only | Rates change with each purchase; past profit must never move |
| 2026-10-31 | Next work, in order: real costs and supplier orders (phase 2), then discounts, then admin-managed plan groups on /plans (Netflix, beIN, Disney+, Apple…; colours per group; delivery by code, ready account or the customer's e-mail; few points) | Owner + council; costs first so new features report real profit |
| 2026-10-31 | Supplier-referred customers: handled by chat, the supplier provides the subscription from his panel, the 2-year offer is 15,000 IQD split 10,000 supplier / 5,000 owner; recorded in the admin, no loyalty points | Owner |
| 2026-10-31 | Panel credit costs 900 IQD per credit-dollar (last purchase: $200 for 180,000 IQD); a free 3-month reward costs 900 IQD | Owner |
| 2026-10-31 | Owner accepts three open risks: unrotated database password, previews writing to production, the Windows-only script bug | Owner |
| 2026-10-30 | Launch announcement postponed; wording still open: «4 تجديدات والخامسة مجاناً» is only always true at a 24-point threshold, while the current threshold is 30 | Owner |
| 2026-10-30 | Customers who subscribed outside the site get no points; the owner's account role is `OWNER` (approves rewards) | Owner |
| 2026-10-30 | Loyalty thresholds 30 (3 months) / 60 (6 months); earn stays 1 point per 1,000 IQD | Halving the earn rate gives fractions and stingy-looking numbers; raising the threshold keeps 78–81% of gross margin |
| 2026-10-30 | Launch seed: a flat 10 points per customer with an active IPTV subscription and a paid completed order on the site | A seed tiered by length favoured 2-year buyers, who need it least |
| 2026-10-30 | VIP excluded from loyalty in v1 | A free VIP renewal has no known cost; giving VIP customers IPTV rewards would mix services |
| 2026-10-30 | Rewards are a free renewal of a fixed supplier length (a 0-price `RENEW` order the owner approves), never a cash discount | The supplier sells only 3m/6m/1y/2y; no discount engine is needed |
| 2026-10-30 | Owner direction: roadmap phases 1–7, stability before expansion, no agents before reliable data | Owner's development direction |
| 2026-10-30 | Packages are sold in several lengths (`PackageOption`) | PR #6 |

The loyalty decisions came from four council reviews; the full plan is
https://claude.ai/artifact/3rn5bZxMo4BJYABtJmXmVy (outside the repo). The implemented rules are in
`docs/loyalty.md`.

## Change log

Newest first.

| Date | PR / commit | Change | Checks |
|---|---|---|---|
| 2026-10-31 | `feat/plan-groups` (PR to `main`, open) | Plan groups and digital platforms: `packageGroup`, `package.groupId`, `packageOption.costIqd`, order delivery fields, `subscription.accountEmail`; DIGITAL service end to end; /plans sections, plan details, checkout e-mail, fulfilment, admin groups, app fields | `TZ=UTC npm test` 231/231; tsc, ESLint, build clean; `scripts/integration/plan-groups.mts` 8/8, costs 9/9, discounts 8/8; e2e loyalty 13/13, package-options 17/17; /plans before/after pixel comparison (3 identical, 1 differs only in an animated tile); demo groups checked RTL/LTR at phone width; group form checked in headless Chrome |
| 2026-10-31 | migrations `20261031T0738_plan_groups`, `20261031T0742_platform_account_email` | Applied on the local database only (6 additive + 1 guarded data step; 1 additive) | `migration check`, `db verify` (local); data step re-run: no change |
| 2026-10-31 | `feat/discounts` (PR to `main`, open) | Discounts: `discount` table, list / discount / price on orders, server pricing in `createOrder`, catalogue + site + checkout + app, admin form with live preview and list, finance totals, analyst aggregates. Two stale test scripts fixed for PR #10's full-access rule | `npm test` 222/222 (UTC and local time); tsc, ESLint, build clean; `scripts/integration/discounts.mts` 8/8; `scripts/integration/costs.mts` 9/9; e2e loyalty 13/13, package-options 17/17; browser check RTL/LTR at phone width |
| 2026-10-31 | migration `20261031T0021_discounts` | Planned and applied on the local database only (5 additive operations); not on production | `migration check`, `db verify` (local) |
| 2026-10-31 | — | Read-only data audit of production (counts only): 77 customers, 54 active IPTV subscriptions, 96 orders. No stuck or unpaid orders, every completed order has a subscription and receipt, receipt amounts match, loyalty ledger reconciles (51 accounts, 550 points). Panel credit recorded (900 IQD/$) and set on the owner's IPTV lengths | READ ONLY transaction |
| 2026-10-31 | fix: full-access checks | Owner-only actions (loyalty approvals and adjustments, panel credit, supplier orders, cost settings) now accept every full-access role (`OWNER` and the legacy `ADMIN`, via `isFullAccess`). The owner's account is `ADMIN` and was refused | 213/213 unit (TZ=UTC); tsc, lint, build clean |
| 2026-10-31 | `feat/real-costs` (PR to `main`, open) | Real costs and supplier orders: `creditPurchase`, `packageOption.creditCostCents`, order channel / supplier share / cost snapshot; owner pages; profit by channel; analyst aggregates | `npm test` 212/213 (the 1 failure is the clock-dependent domain test above; 12/12 with `TZ=UTC`); tsc, ESLint, build clean; `scripts/integration/costs.mts` 9/9; e2e loyalty 13/13, package-options 17/17; pages checked in the browser |
| 2026-10-31 | migration `20261030T2329_real_costs` | Planned and applied on the local database only (8 additive operations); not on production | `migration check`, `db verify` (local) |
| 2026-10-31 | `scripts/loyalty/seed.mjs` | Launch seed on production, owner-approved: 40 customers × 10 points | `--check` before (40 eligible, worst case $13.33); after: 40 already seeded, 0 to seed |
| 2026-10-30 | PR #7 (`0598628`) | «نقاط شاشتنا»: schema, ledger, order hooks, customer pages, admin, mobile API; deployed off. One deliberate change: `saveOrder` never reuses a reward order | 201/201 unit; tsc, lint, build clean; local server e2e 13/13; package-options e2e 17/17 |
| 2026-10-30 | migration `20261030T1747_loyalty_points` | Applied to production (7 additive operations); marker `0395c5c66aa0`; `db verify` passed | Read-only check first: only this migration pending |
| 2026-10-30 | — | Read-only production check: marker `5a6b23eee534`, 20 migrations, nothing from PR #6 pending | `production-migrate.mjs --check` |
| 2026-10-30 | PR #6 (`8adbeb8`) | Navy redesign across the site, plan details pages, packages sold in several lengths | 182/182 unit (per PR); preview green |
| 2026-10-30 | migration `20261030T1021_package_options` | Applied to production with the owner's approval (per PR #6) | Recorded in PR #6 |
| 2026-10-24 | `3bff534` | Netlify Blobs isolated across environments (`SHASHTNA_BLOB_NAMESPACE`) | — |
| 2026-10-23 | `43c5008` | Redesign phase 1 audit → `docs/redesign/phase-1/` | — |
| 2026-10-17 | PR #5 (`541dc3d`) | Admin-managed durations, VIP renewal price; incident: code shipped before its migration | — |
| 2026-10-01 | PR #4 | Finance and BI dashboard | — |
| 2026-09-25 | PRs #1–#3 | Shashtna 2.0 release, branding, manual transfer payment with proof upload | — |

## Related documents

- `docs/loyalty.md` — loyalty rules, settings and launch steps.
- `docs/costs.md` — real costs, credit purchases and supplier orders.
- `docs/discounts.md` — discounts: rules, where they show, admin.
- `docs/plan-groups.md` — plan groups and digital platforms.
- `docs/package-options.md` — packages sold in several lengths.
- `docs/redesign/phase-1/`, `docs/redesign/phase-2/` — redesign reports. They describe the state when they
  were written; the phase-2 note "no commit or PR" is superseded by PR #6.
- `docs/mobile-api.md`, `docs/console-native-foundation.md` — app and console contracts.
