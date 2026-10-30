# Shashtna — progress, decisions and next steps

The single source of truth for project status. Read it at the start of every task, and update it before
calling a task done (rule in `CLAUDE.md` → "Progress tracking"). Detailed reports live in `docs/<area>/`;
this file links to them instead of copying them.

Status marks: ✅ done (with evidence) · 🔄 in progress · ⏳ planned · ⏸️ paused · ❓ needs verification.

## Status now (2026-10-31)

- **Production** runs `main` at `0598628` (PR #7 merged on top of PR #6). The owner checked the live
  site after the deploy: it works.
- **Production database** marker `0395c5c66aa0`, 21 migrations, the latest
  `20261030T1747_loyalty_points`; `prisma db verify` passed.
- **«نقاط شاشتنا» (loyalty points)** is deployed and **switched off** (`loyalty.enabled = off`). Reward options are set
  (Star10 3 months / 6 months). The launch seed ran on 2026-10-31: 40 customers × 10 points = 400 points.
  The owner switched the program on (2026-10-31).
- **Deploy Previews use production** (database, `AUTH_SECRET`, Blobs; an owner decision recorded in
  PR #6). Treat any preview as production.

## Roadmap

Long-term direction, in order. A phase is marked done only with evidence.

| # | Phase | Status | Evidence / notes |
|---|---|---|---|
| 1 | Stabilize the foundation (site, data, orders, payments, activation, deploys) | ✅ | Schema and code in sync on production (marker `0395c5c66aa0`). Open: see "Known risks" |
| 2 | Reliable business data (customers, subscriptions, orders, payments, supplier costs, events) | ⏳ | Next up: real costs (panel credit per option at the IQD rate of each purchase, currently 900 IQD per credit-dollar) and orders via the supplier (supplier share recorded, no points) |
| 3 | Complete the customer and admin experience | 🔄 | Redesign (PR #6) ✅; loyalty (PR #7) ✅ live since 2026-10-31. Next: discounts, plan groups and digital platforms |
| 4 | Operational automation (reminders, follow-ups, alerts; idempotent, observable, human approval) | ⏳ | — |
| 5 | SHASHTNA AI CORE and agents (Customer, Operations, Finance, Marketing) with scoped tools | ⏳ | An AI business analyst exists (aggregates only) |
| 6 | Business intelligence and data-driven growth | ⏳ | Finance/BI dashboard exists (PR #4) |
| 7 | Integrated AI-powered operations, desktop and mobile admin clients on the shared backend | ⏳ | Android console shell exists (`shells/mobile`) |

## In progress

| Item | Status | Where |
|---|---|---|
| Launch «نقاط شاشتنا»: reward options ✅ → `seed --check` ✅ → seed ✅ (40 customers, 400 points) → owner enables ✅ (2026-10-31) → announcement ⏳ | 🔄 | Admin → Settings → نقاط شاشتنا; `scripts/loyalty/`; `docs/loyalty.md` |
| Progress documentation (this file and the `CLAUDE.md` rule) | 🔄 | this branch |

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
  PR #6 / PR #7.

## Next step

The owner switches the program on (Admin → Settings → نقاط شاشتنا) and, when ready, sends the
announcement. Then close phase 1 and move to phase 2 (store supplier costs so profit figures are real).

## Decisions

Newest first. Details are in the linked documents.

| Date | Decision | Why |
|---|---|---|
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
- `docs/package-options.md` — packages sold in several lengths.
- `docs/redesign/phase-1/`, `docs/redesign/phase-2/` — redesign reports. They describe the state when they
  were written; the phase-2 note "no commit or PR" is superseded by PR #6.
- `docs/mobile-api.md`, `docs/console-native-foundation.md` — app and console contracts.
