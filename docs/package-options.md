# Package options (several lengths per package)

One package (for example "IPTV 4K") is sold in several lengths, each with its
own price and optional renewal price. Customers pick the length on the plan's
page (or in checkout) before paying. There is no need for separate packages
with the same name for each length.

## Data

| Table / column | What it holds |
|---|---|
| `packageOption` (new) | `packageId`, `durationMonths` (canonical), `durationUnit` (`MONTH` / `YEAR`, how the admin entered it), `durationLabel`, `price`, `renewalPrice` (null = same as `price`), `isActive`, timestamps. Unique on (`packageId`, `durationMonths`). |
| `subscriptionRequest.packageOptionId` (new, nullable) | The option the customer chose. Null for older orders and device purchases. |
| `package.price`, `renewalPrice`, `durationMonths`, `durationUnit`, `durationLabel` (existing) | Mirror the package's **default option** (its shortest active one), so readers that know nothing about options (older app builds, reports, the legacy admin page) keep seeing a real, sellable length and price. The server re-mirrors them on every save. |

Orders keep their own snapshot of price, length and label (as before), and
activation uses the order's snapshot, so subscriptions get the length the
customer ordered. Editing or removing an option never changes past orders,
receipts or subscriptions.

## Rules (server-side)

- Lengths: whole months, 1–60 (`parseDuration`); prices: whole IQD (`isValidPrice`).
- One option per length per package; at least one active option; at most 12.
- VIP packages: exactly one option, always 3 months.
- An order is priced from the chosen option (`resolveOrderOption`): it must be one of this package's active options. Another package's option, an inactive or removed one, or a malformed id is refused (400), never replaced by another length. Without a choice (older app builds, old links) the default option is used.
- Removing an option that orders used deactivates it and parks it on a negative `durationMonths` (so the same length can be added again); an unused option is deleted.
- Saving options runs in one transaction. A form that references an option removed elsewhere is refused (409) and changes nothing.

Pure rules live in `src/lib/package-options.ts` (unit tests: `tests/package-options.test.ts`); database work in `src/server/package-options.ts`.

## Flow

1. `/plans` and the home rail: one card per package. The length filter covers every length on sale; a card filtered to a length shows that length's price and opens the plan with it chosen.
2. `/plans/<slug>?option=<id>`: choose the length (the address keeps the choice). "Subscribe now" → `/checkout?plan=<slug>&option=<id>` (plus `renew` / `upgrade`).
3. `/checkout`: shows the chosen length and total, lets the customer switch length (the server re-prices), and posts `optionId`. A stale or tampered `option` in the link goes back to the plan's page.

APIs (all additive, backward compatible):
- `GET /api/mobile/catalog`: `options[]` per package.
- `GET /api/mobile/checkout?option=`: `plan.optionId` and `plan.options[]`.
- `POST /api/mobile/orders` and `POST /api/subscription-requests`: optional `optionId`.
- `GET/POST/PATCH /api/admin/packages`: `options[]`. A PATCH without `options` but with price / duration (the legacy admin page) updates the default option.

## Migration and deploy order

Migration `20261030T1021_package_options` (additive):
1. Creates `packageOption` (unique on `packageId` + `durationMonths`, FK to `package`).
2. Adds the nullable `subscriptionRequest.packageOptionId`.
3. Data step: every package without an option gets one copied from its own length, label, price and renewal price (`INSERT … WHERE NOT EXISTS`). The postcheck verifies every package has an option with its own length and price. Packages, orders, receipts and subscriptions are only read.

The code reads `packageOption` on every catalogue page, so:
1. Apply the migration to production first (owner approval, `scripts/db/production-migrate.mjs`).
2. Only then publish this code.

Publishing first breaks every page that lists packages (same failure as the 2026-10-17 incident). Deploy Previews share the production database in the current Netlify settings, so a Preview of this code fails the same way until the migration is applied.

Existing separate packages per length (for example `iptv-3m`, `iptv-6m`, …) keep working as they are, each with one option. To merge them into one package, add the lengths to one package in the admin form and deactivate the others. This is a business decision for the owner; no migration does it.

## Tests

- `npm test`: `tests/package-options.test.ts` (validation, any supported length, duplicates, VIP rule, default option, order option resolution), plus migration checks in `tests/subscription-packages.test.ts` and `tests/production-migrate.test.ts`.
- `scripts/e2e/package-options.mjs` (local server and database only): admin create / validate / edit / stale form, catalogue, plan and checkout pages, server-side pricing, tampered and foreign options, legacy clients, activation length, renewal price, price changes vs past orders, removing a used length, the legacy edit path, inactive packages.
