@AGENTS.md

# Shashtna (شاشتنا) — working guide for Claude Code

The Shashtna website: IPTV and VIP subscription plans, checkout with manual
payment, the customer area ("My Shashtna"), help centre, and the staff
operations console (`/admin`). Arabic-first (RTL), dark UI. Hosted on Netlify
(site `shashtna`, `https://shashtna.netlify.app`); the production database is
PostgreSQL on Neon (per the owner).

Real customers, subscriptions and payment proofs live in production. **Nothing
in production changes without the owner's explicit approval** (see "Production
database" and the last two sections).

## Stack (installed versions)

| | |
|---|---|
| Next.js | 16.3.4, App Router, server components + server actions (Next-specific rules: `AGENTS.md`, imported above) |
| React | 19.2.8 |
| TypeScript | 5.9.3, path alias `@/` = repo root |
| Tailwind CSS | 4.3.3 (`@tailwindcss/postcss`, tokens in `app/globals.css` `@theme`) |
| Prisma | Prisma Next 8: `prisma` 8.0.0-rc.13, `@prisma/orm-postgres` 8.0.0-rc.9 (contract-first, **not** Prisma ORM 7 — ignore `@prisma/client` in package.json) |
| Database | PostgreSQL (Neon in production; local Postgres 15+ or a Neon dev branch for development) |
| Other | `motion` 13, `lucide-react` icons, `bcryptjs`, `@netlify/blobs` (uploads/tickets on Netlify), `@anthropic-ai/sdk` (optional AI business analyst) |
| Node | 22+ (tested on 22.22) |

## Repository map

| Path | Holds |
|---|---|
| `app/(site)` | Public pages: home, `/plans`, `/checkout`, Watch On (`/apps`, `/devices`, `/watch`), `/services`, help, status, legal, auth |
| `app/(site)/(account)` | My Shashtna: dashboard, subscriptions, orders, receipts, support, account, notifications |
| `app/admin` | Staff console: operations, orders, activations, renewals, customers, catalogue (packages/devices), promotions, intelligence/finance, system (admins, security, audit, settings) |
| `app/api` | JSON APIs: `api/admin/*` (console), `api/mobile/*` (customer app, see `docs/mobile-api.md`), `api/console/v1` (native console shells, see `docs/console-native-foundation.md`) |
| `app/ui` | Design-system components (below) |
| `app/components` | Feature components: `site`, `home`, `account`, `auth`, `payment`, `admin/*` |
| `src/lib` | Pure, unit-tested domain logic (roles, order states, subscription duration/state, i18n, sessions, catalogue rules) |
| `src/server` | Server-only services that touch the database (`orders.ts`, `catalog.ts`, `subscriptions.ts`, `checkout-selection.ts`, …) |
| `src/prisma` | `contract.prisma` (source of truth), generated `contract.json` / `contract.d.ts`, `db.ts` |
| `migrations/app` | Prisma 8 migration packages + `refs/db.json` |
| `src/content` | Help, FAQ and legal copy |
| `tests` | Unit tests (`*.test.ts`, Node test runner) |
| `scripts/e2e` | End-to-end scripts against a **local** DB and server |
| `shells/mobile` | Android "Console" shell (Capacitor) for `/admin` |
| `shells/desktop` | Local, untracked Windows-shell build leftovers. **Never commit, delete or modify.** |

Put pure rules in `src/lib` (and test them); put database access in `src/server`;
keep pages and API routes thin.

## Commands

```bash
npm install            # postinstall runs `prisma skills sync` (refreshes .claude/skills/prisma-8)
npm test               # unit tests: node --test … tests/*.test.ts (no database)
npx tsc --noEmit       # type check
npx eslint <changed files>
npm run contract:emit  # after editing src/prisma/contract.prisma (offline)
npm run dev            # http://localhost:3000 — uses DATABASE_URL (check the target first)
npm run build          # production build — needs DATABASE_URL (check the target first)
```

- **Lint baseline:** `npm run lint` currently fails with 13 pre-existing errors, all in `app/api/admin/devices/route.ts`. Lint the files you changed; don't "fix" that file as a side effect.
- **Before calling a change done:** run `npm test`, `npx tsc --noEmit`, ESLint on the changed files, and `npm run build`.
- **E2E scripts** (`scripts/e2e/*.mjs`) need a local Postgres, a running local build, and `DATABASE_URL` in the environment. They refuse non-local databases.

## Local environment

- **Setup:** copy `.env.example` to `.env`.
- **Env files:** the Prisma CLI reads `DATABASE_URL` from the shell environment first, then `.env` (`dotenv` in `prisma.config.ts`). It never reads `.env.local`. Next reads both, so keep `DATABASE_URL` in `.env` only, or identical in both.
- **Variables** (names only):
  - `DATABASE_URL`, required at build and run time.
  - `AUTH_SECRET`, 32+ characters.
  - Optional: `SHASHTNA_STORAGE` (`local` | `netlify`) and `ANTHROPIC_API_KEY`.
- **`DATABASE_URL` must point at a local database or a Neon development branch, never production.**
- **First admin:** register, then set the role to `OWNER` in the **local** DB (see `LOCAL_SETUP.md`).

## Database commands: check the target first

| Group | Commands |
|---|---|
| **Offline** (never touch a database) | `npm run contract:emit`, `npx prisma migration plan`, `npx prisma migration check`, `npx prisma migration list / graph / show`, `npx prisma migration ref set`, self-emitting `node migrations/app/<dir>/migration.ts` |
| **Read a database** | `npx prisma db verify`, `npx prisma db schema`, `npx prisma db migrate --show`, `npx prisma migration status`, `npx prisma migration log` |
| **Write a database** | `npx prisma db migrate`, `npx prisma db update`, `npx prisma db init`, `npx prisma db sign`, `scripts/e2e/*.mjs`, any SQL |
| **May read or write a database** | `npm run dev`, `npm start` — starting the server alone does not necessarily write, but using the site (pages, sign-up, orders, admin actions) reads and writes the database in `DATABASE_URL` |
| **Requires `DATABASE_URL` — database access not confirmed** | `npm run build` — fails without the variable; whether the build itself queries the database has not been verified, so check the target before building too |

Before **any** command in the last four groups, in the same shell:
1. Print only the host and database name of the effective target (no credentials):
   `node -e "require('dotenv').config({ quiet: true }); const u = new URL(process.env.DATABASE_URL); console.log(u.hostname + u.pathname)"`
2. Continue only if it is local (`localhost` / `127.0.0.1`) or a Neon development branch the owner named for this work.
3. Otherwise, or if unsure, stop and ask. Never pass a production URL with `--db`.

Never use `db update` or `db init` on any shared database; they are for a throwaway local database only.

## UI: Arabic-first RTL design system

- **Language and direction:**
  - `lang`/`dir` come from the `shashtna_lang` cookie, default `ar`/`rtl` (`src/lib/i18n.ts`).
  - Every user-facing string is bilingual through `t("عربي", "English")`. Server: `const { t, lang } = await getI18n()`. Client: `const { t, language } = useLanguage()`.
  - Arabic copy is the primary voice: natural, clear Arabic, not literal translation.
- **Direction-safe layout:** use logical utilities (`ms-/me-/ps-/pe-/start-/end-/text-start/text-end`), not `ml-/mr-/left-/right-`. Mirror directional icons with `ltr:rotate-180` (existing convention).
- **Numbers and money:**
  - `formatPrice(value, lang)` gives `10,000 د.ع` / `10,000 IQD`. Prices are whole IQD.
  - Dates use `formatDate` / `formatDateTime`.
  - Arabic uses Latin digits (`ar-IQ-u-nu-latn`).
  - Add the `nums` class on numeric text.
- **Durations:** use `formatDuration` / `formatDurationAr` from `src/lib/subscription-duration.ts` (correct Arabic number agreement), not string concatenation.
- **Theme:**
  - Dark only (`<html class="dark">`), font Thmanyah Sans (loaded from jsDelivr in `app/globals.css`).
  - Colour tokens: `canvas`, `surface(-2/-3)`, `line`, `ink(-2/-3)`, `brand(-strong/-ink)`, `glow`, `sky`, `success/warning/danger/info`, `vip-1..3`.
  - Utilities: `glass`, `glass-strong`, `glass-bar`, `surface`, `surface-raised`, `nums`.
  - Use tokens, never raw hex values.
- **Components (`app/ui`)** — reuse before creating new ones:

  | File | Components |
  |---|---|
  | `Button` | `Button`, `LinkButton`, `buttonClass` (variants and sizes are typed) |
  | `Page` | `Container`, `PageHeader`, `SectionHeading`, `Eyebrow` |
  | `Card` | `Card`, `CardHeader`, `Stat` |
  | `States` | `EmptyState`, `ErrorState`, `UnauthorizedState`, `Notice`, skeletons |
  | `Field` | `Field`, `Input`, `Select`, `Textarea`, `Checkbox` |
  | Others | `Dialog`, `Toast` (`useToast`), `DataTable`, `Tabs` (`LinkTabs`), `Badge`/`StatusBadge`, `Pagination`, `PackageCard`, `DeviceCard`, `OrderJourney`, `OrderStepper`, `cn` |

  Admin building blocks live in `app/components/admin/*` (e.g. catalogue `CatalogueUI`, dashboard `SectionCard`).
- **Checks for every UI change:**
  - Works at phone width with no horizontal scroll.
  - Correct in RTL **and** LTR.
  - Every failure has a clear Arabic error state.

## Domain rules (verified in code — keep them true)

**Services:** `IPTV` and `VIP` are separate services and are never interchangeable.

**Packages** (`package` table) are data, edited in Admin → Catalogue → Subscription packages:
- **Customer visibility:** customers only see and buy `isActive = true` packages. Disabling a package hides it but keeps history.
- **Duration:**
  - Whole months, 1–60, entered as value + unit (`MONTH` / `YEAR`).
  - `durationMonths` is canonical.
  - VIP packages are always 3 months.
- **Prices:** whole IQD, 0–100,000,000 (`isValidPrice`).
- **Renewal price:** `renewalPrice` is optional. When null, renewals cost the normal price.
- **Slugs:** a package's slug is locked once orders reference it.
- **Options (lengths):** a package is sold in one or more lengths, each with its own price and renewal price (`packageOption` table, edited in the package form). See `docs/package-options.md`.
  - The rules above (duration, price, renewal price) apply per option; one option per length per package; at least one active option.
  - VIP packages have exactly one option (3 months).
  - `package.price` / `renewalPrice` / `duration*` mirror the default option (the shortest active one) for older readers; edit options, not these columns.
  - A removed option that orders used is kept inactive (parked on a negative `durationMonths`), never deleted.

**Orders** (`subscriptionRequest` table), via `createOrder` in `src/server/orders.ts`:
- **Types:** `NEW`, `RENEW`, `UPGRADE`, `DEVICE_PURCHASE`.
- **Pricing:** the price is always computed on the server from the catalogue (`planOrderPrice`). Client-sent prices are ignored.
  - VIP `NEW`/`UPGRADE` = the package's normal price + a compatible, active VIP device (`packageDevice`).
  - `RENEW` = the package's renewal price (or its normal price when unset), with no device.
- **Snapshots:** each order stores its price, duration and label at purchase time. Editing a package never changes past orders, receipts or subscriptions.
- **Statuses:** `SUBMITTED → AWAITING_PAYMENT → PAID → FULFILLING → COMPLETED`, plus `CANCELLED`/`REJECTED`. Legacy `PENDING`/`ACCEPTED` map onto these (`src/lib/order-status.ts`).
- **Payment:** manual transfer (`تحويل يدوي`) with an uploaded proof (≤ 4 MB). The site never takes card payments.

**Activation and renewal:**
- **Who activates:** staff only, via `/admin/subscription-requests/[id]/add` → `POST /api/admin/subscriptions`. Creating an order or confirming payment never activates anything by itself.
- **Expiry:** calendar months from the start date, clamped to month end (`addMonthsClamped`).
- **Renewals:**
  - Extend the current expiry while it is still active.
  - Only extend a subscription of the **same service and customer**.
  - VIP renewals are exactly 3 months.

**Loyalty points («نقاط شاشتنا»)** (`src/lib/loyalty.ts` pure rules, `src/server/loyalty.ts` database side, `docs/loyalty.md`):
- **Off by default** (`loyalty.enabled` in Admin → Settings). While off: no earning, no redemption, no customer UI; orders completed then never earn later. No backfill: the only pre-launch points are the one-time seed (`scripts/loyalty/seed.mjs`, `--check` counts only).
- **Earning:** IPTV `NEW`/`RENEW`/`UPGRADE` orders with price > 0 that reach `COMPLETED` earn 1 point per 1,000 IQD of the order's stored price (rounded down), or the option's `packageOption.pointsEarned`. Never devices, VIP or reward orders. Points unlock after `loyalty.pendingDays`; the whole balance expires `loyalty.expiryMonths` after the latest IPTV expiry (written on read, no cron).
- **Rewards:** a free IPTV renewal (3 or 6 months, lengths picked in Settings) for `loyalty.reward3mPoints` / `reward6mPoints`. Created only by `redeemReward` as a 0-price `RENEW` order with `loyaltyReward = true` (never through `createOrder`/`saveOrder`; `requestType` stays one of the four). One open reward at a time, one redemption per `loyalty.cooldownDays`.
- **Owner only:** approving a reward (SUBMITTED → PAID, no payment step), manual `ADJUST`/`REVERSE` with a reason. Activation is the normal renewal path at price 0 and the reward's length. A rejected/cancelled reward returns its points (`REDEEM_RETURN`).
- **Ledger:** `loyaltyEntry` is append-only with a unique `idempotencyKey` and a `rule` snapshot; `loyaltyAccount.balance` always equals the sum of its entries (reconciliation in Admin → Shashtna Points). Rule changes apply to future entries only.
- **Finance:** reward orders are excluded from revenue, sales counts, average order value, product rows and the analyst fact pack; they are reported separately.
- **VIP and IPTV never mix:** VIP is out of the program in v1.

**Real costs and supplier orders** (`src/lib/costs.ts`, `src/server/costs.ts`, `src/server/supplier-orders.ts`, `docs/costs.md`):
- An order's cost is snapshotted when it completes: the option's `creditCostCents` × the latest `creditPurchase` rate → `creditCostIqd` (+ `creditPurchaseId`). Never recompute past orders; credit purchases are append-only.
- An unknown cost is `null` («تكلفة غير معروفة») and is never counted as zero in profit.
- `channel` is `SITE` (site or direct) or `SUPPLIER` (made by the supplier from his panel: credit cost 0, `supplierShareIqd` stored). Supplier orders never earn loyalty points. Recording credit and supplier orders is OWNER-only.

### Prices — where values come from

The database is the only source of truth at runtime. **No price below is a
confirmed commercial price.** The owner sets and confirms prices in the
dashboard. Never hard-code subscription prices, durations or package lists, and
never quote a price as current without reading it from the database the owner
points you to.

| | Normal price | Renewal price |
|---|---|---|
| **Code** | None for subscription packages; validation only (whole IQD, 0–100,000,000) | None; null means "same as the normal price" (`planOrderPrice`) |
| **Migration `20261016T0559_package_duration_unit`** | IPTV, inserted only if the duration is missing: 3 months 6,000 (`iptv-3m`), 6 months 10,000 (`iptv-6m`). IPTV, repriced if the row exists: `iptv-1y` (12 months) → 15,000, `iptv-2y` (24 months) → 25,000. Otherwise inserted as `iptv-12m` / `iptv-24m` | Not set |
| **Migration `20261017T1832_package_renewal_price`** | Not set (VIP normal price is never written by a migration) | VIP 3-month packages with no renewal price → 35,000 |
| **Any database** (production, dev branch, local) | Read it; values differ per database and may have been edited in the dashboard | Read it |

Separate from subscriptions: `/services` (web development and similar
services) shows "starting from" prices written in code
(`app/(site)/services/page.tsx`). Change them only on the owner's request.

## Production database

**Off-limits by default.** Without the owner's explicit approval, for that
specific action, in the current conversation, do not:
- connect to the production database, even read-only, even with `--check` / `--show`;
- run any migration, `prisma db …` command (`migrate`, `update`, `sign`, `verify`), seed or SQL against it;
- change Neon settings, roles or branches;
- run Prisma platform commands (`prisma deploy`, `prisma postgres`, `prisma branch`, `prisma project`, `prisma auth`). This project doesn't use the Prisma platform; it is hosted on Netlify.

When approval is needed:
1. Say exactly what will run.
2. Name the target without revealing any secret.
3. Show the expected impact, and the `--show` / `--check` output from a non-production copy where possible.
4. Wait for a clear "yes".

A general request ("deploy it", "fix production") is not approval for a database change.

## Database: Prisma 8, contract-first

Read `.claude/skills/prisma-8` (synced by `npm install`) before any Prisma work.
Your memory of Prisma is likely wrong for this version.

- **Schema:** `src/prisma/contract.prisma` is the single source of truth. After editing it, run `npm run contract:emit`. Never hand-edit `contract.json` / `contract.d.ts`.
- **Queries:** use `db.orm.public.<Model>` (`.where/.first/.all/.create/.update`) from `@/src/prisma/db`. The ORM selects every contract column, so **code that adds a column fails in any database that lacks it.**
- **Migration history:**
  - Recorded in `prisma_contract.ledger` (applied migrations and their `migration_hash`) and `prisma_contract.marker` (current contract hash).
  - There is no `_prisma_migrations` table.
- **Changing the schema** (local database or Neon dev branch only; run the target check above before steps 4–5):
  1. Edit `contract.prisma`, then run `npm run contract:emit`.
  2. Run `npx prisma migration plan --name <snake_name>`. This writes `migrations/app/<timestamp>_<name>/`.
  3. Data changes: edit the generated `migration.ts`, then self-emit with `node migrations/app/<dir>/migration.ts`.
  4. Run `npx prisma migration check` (offline integrity check).
  5. Apply to the dev database: `npx prisma db migrate --show`, then `npx prisma db migrate`, then `npx prisma db verify`.
  6. Advance the dev ref: `npx prisma migration ref set db <migration dir name>`. Commit `refs/db.json` with the migration.
- **Migration rules:**
  - Additive only by default: add nullable or defaulted columns; never drop or rewrite customer data.
  - Data steps must be guarded and idempotent, and limited to the rows they mean to touch (for example, filter by `serviceType`).
  - **Never edit a migration that any database has applied.** The CLI does not detect a changed `migration_hash`; it silently skips the edited migration. Add a new migration instead.
- **Deploy order:**
  - The Netlify build (`next build`) does **not** run migrations.
  - Code that needs new columns must only be published after its migrations are applied to production, which needs the owner's approval as above.
  - Publishing code first breaks the site. Incident 2026-10-17: `column package.durationUnit does not exist`.
  - A PR that adds a migration must say so and state this order.

## Security and customer data

- Never print, log, commit or paste secrets: `DATABASE_URL`, `AUTH_SECRET`, API keys, connection strings, `.env*` contents.
- Never expose customers' phone numbers, IPTV credentials, payment proofs or receipts in logs, test output, screenshots or AI prompts. Subscription passwords are masked; revealing one is audited (`SUBSCRIPTION_CREDENTIALS_REVEALED`).
- **Auth:**
  - Website sessions are HttpOnly signed cookies (`shashtna_session`); the app uses Bearer tokens.
  - Every admin API calls `requireAdmin(request, "<permission>")`, and every admin page calls `requireStaffPage(path, "<permission>")`.
  - Permissions are checked on the server from the role stored in the database.
  - Roles: `OWNER`/`ADMIN` (all), `OPERATOR`, `SUPPORT`, `CONTENT`, `CUSTOMER` (`src/lib/roles.ts`).
- **Server-side validation:** validate every input on the server (whole numbers, ranges, enums). Never trust client prices, totals, statuses or durations.
- **Public API contracts:** `api/mobile/*` and `api/console/v1/*` are used by shipped apps. Only make additive, backward-compatible changes.
- **AI analyst:** the analyst sends only aggregate figures to Anthropic, never customer data.

## Git, pull requests and deploys

- `main` is the release branch. Work on a feature branch, then open a PR to `main`.
- **Unverified:** whether a merge to `main` publishes to production automatically (Netlify production branch, auto-publishing and locks). Until it is checked in Netlify, **treat a merge to `main` as possibly going live immediately.**
- Netlify builds a **Deploy Preview** for each PR (status `netlify/shashtna/deploy-preview`). It shows the build works, not that production's database is ready.
- **Before a PR:**
  - Tests, typecheck, lint on changed files, and build all pass.
  - The PR description lists any migration and the deploy order.
- Keep commits focused, with clear messages. Never rewrite pushed history on shared branches.
- **Rollback:** an owner action in Netlify (Deploys → publish an earlier deploy). It changes code only, not data.

## Available skills and tools

- **In the repo:**
  - `.claude/skills/prisma-8` (synced by `npm install`): use it for any Prisma work.
  - The Neon skills (`neon`, `neon-postgres`, `neon-postgres-branches`, …): use them for Neon and branching questions.
  - `prisma-composer-core-concepts`.
- **Design skills**, installed on the owner's machine (not in the repo). Use them when they are available in your session:
  - **`impeccable`:** `/impeccable critique|audit|polish|…`.
  - **`design-taste-frontend`** (taste-skill).
  - **Emil Kowalski's skills:** `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `break-ui`, …
  - Critique first and propose a plan before large visual changes. Keep the results inside the existing tokens and components.

## Never do

- Change anything in production on your own initiative: database, deploys, Netlify / Neon / DNS settings.
- Push to `main` or merge PRs without the owner's approval.
- Edit an already-applied migration, delete migrations, or reset or drop any database other than a throwaway local one.
- Delete or rewrite customers, orders, subscriptions, receipts, payment proofs or packages. Disable packages instead of deleting them.
- Hard-code subscription prices, durations or package lists. Mix IPTV and VIP rules.
- Commit secrets or `.env*` files, or commit or delete `shells/desktop/`.
- Weaken auth checks, server-side validation or credential masking to make something work.

## Requires the owner's explicit approval

- **Production database:** any access to it, even read-only, and any change to it, including already-written migrations.
- **Deploys and Git:** merging to `main`, deploying or republishing, rollbacks, and build or deploy configuration (`netlify.toml`, build command, env vars).
- **Business changes:** prices, packages, business rules, and anything customer-visible in copy or pricing.
- **Other:** changes to `api/mobile` or `api/console` contracts, new dependencies, and deleting files.

## Progress tracking (required)

- `docs/PROGRESS.md` is the single source of truth for project status, roadmap phases, decisions, known risks and the next step. Read it at the start of every task.
- A task is not done until `docs/PROGRESS.md` is updated in the same branch:
  - the status (✅ done / 🔄 in progress / ⏳ planned / ⏸️ paused / ❓ needs verification);
  - what actually changed, and the key files;
  - the tests run, with their real results;
  - the commit or PR;
  - remaining risks;
  - new decisions with their reasons;
  - the updated next step.
- Never mark anything done without evidence (a commit, PR, migration output or test output). Plans and attempts stay ⏳ or 🔄.
- Detailed reports stay in `docs/<area>/`. `PROGRESS.md` links to them instead of copying them.
- Every PR description states "docs/PROGRESS.md updated".

## Known risk (temporary note, re-verified 2026-10-30 — update or delete when it no longer applies)

- **Resolved:** production has every migration up to `20261030T1747_loyalty_points` (marker `0395c5c66aa0`, `db verify` passed, 2026-10-30, owner-approved). `main` (PR #6 and PR #7) is deployed. Loyalty is deployed **off**.
- **Open:** see "Known risks" in `docs/PROGRESS.md` (previews write to production; database password to rotate; `scripts/db/production-migrate.mjs` does not run on Windows).
- **Unverified:** whether a merge to `main` publishes automatically (both 2026-10-30 merges went live).
