# Discounts

A discount lowers the price of one package option (a product at one length). The server is the only source of the price; every order stores what it was charged and why.

## Rules

- **Type.** `PERCENT` (1–90) or `AMOUNT` (whole IQD). The customer's price is rounded down to whole IQD and never goes below 0. A fixed amount must stay below the option's price, and below its renewal price when renewals are included.
- **Window.** Optional `startsAt` / `endsAt` (entered in Baghdad time). A discount is active inside `[startsAt, endsAt)` until it is ended. With no end date it lasts until ended.
- **One at a time.** At most one active discount per option. A save whose window overlaps another discount of the same option is refused with «هذه المدة عليها خصم ثاني بنفس الفترة». The check runs under a row lock on the option, so two admins can't race.
- **Scope.** `NEW` and `UPGRADE` orders always. `RENEW` only when «يشمل التجديد أيضًا» is ticked.
  - A VIP discount covers the package price only; the device is always full price. Device discounts are deferred (owner, 2026-10-31).
- **Never discounted.** Reward orders (price 0, created by `redeemReward`) and supplier orders (`createSupplierSubscription`). Neither goes through `createOrder`.
- **Ending.** Ending a discount sets `endedAt`. Rows are never deleted, and orders that used one keep their snapshot.

## Orders

`createOrder` prices every plan order with `orderPricing` (`src/lib/discounts.ts`) and stores four fields:
- `price`: what the customer is charged;
- `listPrice`: the price before the discount;
- `discountId`;
- `discountIqd`.

The three discount fields are always written. So when `saveOrder` reuses an unpaid order, the order is repriced at today's price, with or without a discount. A paid order never changes.

Loyalty points are earned on the stored `price`, i.e. after the discount. The real-cost snapshot is unchanged, so profit drops by the discount.

## Where it shows

| | |
|---|---|
| `/plans`, home rail, plan details | The old price struck through (muted), the new price, a badge «خصم 20%» / «وفّر 2,000 د.ع», and «ينتهي خلال X أيام» when there is an end date. The days left are computed on the server. Shared component: `app/components/plans/DealTag.tsx` |
| Checkout | The plan price, a «الخصم» line, and the total to pay |
| Customer order page, admin order page | «السعر قبل الخصم» and «الخصم» rows |
| Mobile API (additive) | `GET catalog`: each option has `discount`. `GET checkout`: `plan.listPrice`, `plan.discount` (with `amount`), and `options[].orderPrice` after the discount |
| Admin | Catalogue → the package → «الخصومات»: per length, add, edit or end a discount, with a live preview. Catalogue → «الخصومات» lists active and scheduled ones. Changes are full-access only and audited (`DISCOUNT_CREATED` / `DISCOUNT_UPDATED` / `DISCOUNT_ENDED`, with before and after values) |
| Finance | Discounted sales and the total discount given, for the period and the previous period. The analyst fact pack gets the same aggregates |

**Not yet:** the home-page VIP section and the stage's «من …» prices still show list prices. The plan pages, checkout and the order itself use the discounted price.

## Code

| | |
|---|---|
| Pure rules (unit-tested) | `src/lib/discounts.ts`, `tests/discounts.test.ts` |
| Database side | `src/server/discounts.ts` |
| Admin | `app/admin/catalogue/discounts/`, `app/components/admin/catalogue/DiscountForm.tsx` |
| Integration (local DB) | `scripts/integration/discounts.mts` |
| Migration | `20261031T0021_discounts` (additive) |
