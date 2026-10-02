# Mobile API (`/api/mobile/*`)

The contract of the Shashtna customer app (`ODEN-AI/shashtna-mobile`). It is an
adapter over the website's own services: one `User` table, one password hash and
login throttle, one order system, one catalogue, one ticket store. Nothing here
decides prices, statuses or permissions.

```
app (v1.0.0 / v2.0.0)  →  app/api/mobile/*  →  src/server/mobile/*  →  website services  →  database
```

| Module | Role |
|---|---|
| `src/server/mobile/http.ts` | Envelope `{ success, … }` / `{ success: false, code, message }`, Bearer-only auth with the full session check, `private, no-store` |
| `src/server/mobile/sessions.ts` | App sign-out-everywhere (logout-all, password change) |
| `src/server/mobile/shape.ts` | Response shapes: orders, subscriptions, tickets, content, incidents, help channels |
| `src/server/mobile/dashboard.ts` | Home screen in one request |
| `src/server/mobile/destinations.ts` | Website paths → typed app destinations |
| `src/server/customer-auth.ts` | Password sign-in + registration, shared with `/api/auth/login` and `/api/auth/register` |
| `src/server/checkout-selection.ts` | Checkout selection, shared with the website checkout page |

## Endpoints

| Endpoint | Source of truth |
|---|---|
| `POST auth/login` | `passwordSignIn` (bcrypt, `LoginThrottle`: 429 + `retryAfter`) |
| `POST auth/register` | `registerCustomer` → `User` role CUSTOMER (visible in Admin → Customers) |
| `POST auth/password-reset/request`, `…/complete` | `password-reset.ts` (staff-assisted code) |
| `POST auth/logout-all` | ends every app session of the account |
| `GET/PATCH me`, `POST me/password` | `User`; password change ends other app sessions, returns a fresh token |
| `GET catalog` | `getActivePackages` / `getActiveDevices` (live prices) |
| `GET content`, `GET content/{id}` | `getLiveAnnouncements("WEBSITE")` + `audienceMatches` |
| `GET help` | `src/content/help.ts`, `TICKET_CATEGORIES`, Admin → Settings contacts (WhatsApp when configured) |
| `GET status` | `getActiveIncidents` / `getRecentResolvedIncidents` |
| `GET checkout?plan=&renew=&upgrade=&device=` | `resolveCheckoutSelection` (preview only) |
| `GET/POST orders`, `GET orders/{id}`, `POST orders/{id}/cancel`, `GET/POST orders/{id}/proof` | `createOrder`, `listOrdersForUser`, `getOrderForUser`, `cancelOrderByCustomer`, `savePaymentProof`, `setOrderContact` |
| `GET subscriptions`, `GET subscriptions/{id}` | `listSubscriptionsForUser` / `getSubscriptionForUser` |
| `GET/POST support/tickets`, `GET/POST support/tickets/{id}` | `tickets.ts` (Admin → Support) |
| `GET notifications`, `POST notifications/read` | `notifications.ts` |
| `POST/DELETE devices` | accepted, not stored (no push-device table): `deviceId: null` |
| `GET dashboard?order=` | the services above |
| `GET config`, `GET receipts`, `GET/POST subscription-requests`, `PUT account/profile` | older app build (v1.0.0), unchanged responses |

## Rules

- **Auth:** `Authorization: Bearer <token>` only (the website cookie is not accepted). Every request re-reads
  the account; Console device tokens are refused; staff accounts keep the Console session rules; a token
  issued at or before the account's last app sign-out-everywhere is refused.
- **Ownership:** orders, proofs, subscriptions and tickets are read by `(id, userId)`; another customer's id
  answers 404. An older build's `userId` field is checked, never trusted (mismatch → 403).
- **Prices:** never read from the client; `createOrder` prices from the catalogue.
- **IPTV credentials:** only `GET subscriptions/{id}` (like the website's subscription page). Lists and the
  dashboard carry `credentials: null` and null flat fields.
- **Content:** Admin kinds `AD` (and other promotional kinds) → `OFFER`; `ANNOUNCEMENT`/`NEWS` → `ANNOUNCEMENT`.
  Public content uses the guest audience; the dashboard uses the customer's account state. `PLAYER`-only
  items are never shown.
- **Caching:** every response is `private, no-store`; the app's own query cache refetches.
- **Compatibility:** responses are additive. Shared paths (`subscriptions`, `support/tickets`) carry the
  fields both app generations read.
