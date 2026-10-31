# Plan groups and digital platforms

Platforms such as Netflix, beIN Sports and Disney+ are sold as groups on the existing `/plans` page. There is no new page. The owner creates and edits the groups in the dashboard; nothing about them is fixed in code.

## Model

- **`packageGroup`.** Each group has:
  - a name and English name;
  - a `slug`, an optional logo and descriptions;
  - a `sortOrder` and an `isActive` flag;
  - `accent` and `surface` colours;
  - a `delivery` type;
  - a `serviceType`.

  The two built-in groups, `iptv` and `vip`, are created by the migration. Every other group is a digital platform.
- **`package.groupId`.** Each subscription type is its own package inside its group, for example «Netflix Premium 4K» and «Netflix Basic». Its lengths and prices are options, as for any package, so discounts, costs and points work unchanged (owner decision).
- **Service type `DIGITAL`.** It is shared by every platform; the group keeps platforms apart (owner decision). It never mixes with IPTV or VIP:
  - `normalizeServiceType` returns IPTV, VIP or DIGITAL;
  - devices use `normalizeDeviceServiceType`, which never returns DIGITAL;
  - a DIGITAL package is sold only inside an active DIGITAL group;
  - a renewal extends only a DIGITAL subscription of the same group.

## Delivery (per group)

| Delivery | Checkout | Fulfilment (staff with "subscriptions") | Customer sees |
|---|---|---|---|
| `CODE` | Nothing extra | Enter the code. The order completes with no subscription and no receipt; a code is one-off, so it can't be renewed | The code on their order page and in the app's order detail, owner only |
| `ACCOUNT` | Nothing extra | Enter the ready account's e-mail and password. This creates, or on a renewal extends, a DIGITAL subscription | The account e-mail and password on the subscription page |
| `CUSTOMER_EMAIL` | The customer's own account e-mail, required and validated. A renewal can reuse the one on the subscription | Confirm the activation. This creates or extends the subscription on that e-mail | The e-mail on the order and on the subscription |

**Masking.** Staff see a code masked. Every reveal is audited (`ORDER_DELIVERY_CODE_REVEALED`, listed with the security actions). Account passwords use the existing masked, audited credential reveal.

Order shapes never carry the code, only `hasDeliveryCode`. The app gets `deliveryCode` only on the owning customer's order detail, and `credentials.accountEmail` only on the subscription detail.

## Colours

Colours are data, rendered as CSS variables (`--group-accent`, `--group-surface`, `--group-on-accent`) on the group's section.

The server's `checkColours` requires WCAG AA (4.5:1) for three pairs:
- the accent on the surface;
- light text on the surface;
- the button label on the accent (dark or light, whichever reads better).

A failing pair is refused, and the server suggests the nearest compliant shades. The dashboard offers preset pairs (all compliant), a live preview and the same check.

## Loyalty and costs

- **Points.** Platform orders earn 1 point per 5,000 IQD, or the option's `pointsEarned`. Rewards stay IPTV renewals, so platforms never redeem.
- **Costs.** A platform length can carry a fixed IQD cost (`packageOption.costIqd`), used when no panel credit is set. An unknown cost stays null.

## Where

| | |
|---|---|
| `/plans` | IPTV and VIP first, unchanged. Then one section per active platform group with packages on sale, by `sortOrder`. Empty and hidden groups don't render. The home page rail stays IPTV/VIP |
| Admin | Catalogue → «المجموعات والمنصات» (create, edit, reorder, hide; colours with preview and check; delivery). The package form picks the group, which sets the service, plus a fixed cost per length. The order page has platform fulfilment and the audited code reveal |
| App | `GET catalog` → `groups[]`, `packages[].groupId`. `POST orders` → `deliveryEmail`. `GET orders/{id}` → `deliveryCode` (owner only). See `docs/mobile-api.md` |
| Code | `src/lib/groups.ts` (unit-tested in `tests/groups.test.ts`), `src/server/groups.ts`, `src/server/platform-orders.ts`; integration in `scripts/integration/plan-groups.mts` |
| Migrations | `20261031T0738_plan_groups`: additive, plus a guarded data step that creates the built-in groups `ON CONFLICT DO NOTHING` and places only ungrouped IPTV/VIP packages. `20261031T0742_platform_account_email`: additive |
