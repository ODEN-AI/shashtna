# Console native shells — server foundation (Phase 10A)

The Windows (Tauri 2) and Android (Capacitor) Console apps are thin shells around
the existing web Console. They add OS integration; they do not get a second UI,
a second backend or a second authentication system. This document describes
the server pieces that exist for them today.

## Device credential model

1. Staff sign in with their password inside the shell's web view
   (`POST /api/auth/login`, unchanged). That sets the normal `shashtna_session`
   HttpOnly cookie.
2. The shell's **native HTTP layer** (never page JavaScript) calls
   `POST /api/console/v1/devices/register` with that session. The server creates
   a `ConsoleDevice` row and returns, once, a credential
   `scd1.<deviceId>.<secret>` (32 random bytes). Only `sha256(secret)` is stored.
   The device is bound to the sign-in time of that session (`authenticatedAt`).
3. The shell stores the credential in OS secure storage (Android Keystore /
   Windows Credential Manager), optionally behind a local biometric gate.
4. On launch / when the session ends, the shell calls
   `POST /api/console/v1/session/exchange` with the credential. The server
   checks the device (exists, not revoked, still signed in), the account (exists,
   still staff), the 7-day staff maximum counted from `authenticatedAt`, and
   sign-out-everywhere; then sets the **existing** session cookie with a short
   (12 h) token carrying the device id. No token is returned in the body.
5. Every request with that session re-checks the device (owner, not revoked,
   still signed in, same sign-in) on top of the existing staff checks.

The 7-day maximum is absolute: after it, the user must sign in with the password
again and re-register (pass `deviceId` to re-bind the same device).

Never on the device or in a response: passwords, `AUTH_SECRET`, password hashes,
database credentials, the credential verifier, push tokens.

## Endpoints (`/api/console/v1`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/session/exchange` | device credential | Credential → session cookie (throttled) |
| POST | `/session/logout` | session | End this session; for a device session also clears its credential |
| POST | `/devices/register` | browser staff session | Register / re-bind a device; credential returned once |
| GET | `/devices` (`?scope=team`) | staff session | Own devices; all staff devices with the `staff` permission |
| POST | `/devices/:id/rename` | owner or `staff` permission | Rename (audited unless no-op) |
| POST | `/devices/:id/revoke` | owner or `staff` permission | Permanently block a device (audited) |

POST bodies must be `application/json` (≤ 4 KB); a foreign `Origin` is rejected.
Responses are `Cache-Control: no-store`. No heartbeat endpoint: `lastSeenAt` is
written at exchange and at most every 15 minutes during device sessions.

## Logout vs revoke vs sign out everywhere

- **Logout** (`/session/logout`): this device's session and credential end; the device row stays (re-bind later).
- **Revoke** (security page or API): the device is blocked permanently.
- **Sign out of all devices** (existing): every browser and device session of the user ends; device credentials bound before it stop exchanging.

## Reserved names

- Production origin: `https://shashtna.netlify.app` (no custom domain confirmed; App Links bind to the host, so decide before the deep-link phase).
- Custom URL scheme: `shashtna-console://`. The customer app (`ODEN-AI/shashtna-mobile`) uses `shashtna://`; Shashtna Player registers none.

## Database

Migration `migrations/app/20261001T2236_console_device` (additive only): tables
`consoleDevice` and `loginThrottle`, one unique constraint, two indexes.

Apply in production (after review and deploy), with the production `DATABASE_URL`:

```sh
npx prisma db migrate --show   # preview: 1 migration, 20261001T2236_console_device
npx prisma db migrate          # apply
npx prisma db verify           # marker and schema match the contract
```

## Not in this phase

Capacitor / Tauri projects, Keystore / Credential Manager code, biometrics,
push (FCM / WNS), App Links / `assetlinks.json`, scheme handling, packaging,
signing and updates.

---

# Phase 10B — Console client contract

The contract lives in code; this section is the map.

| Piece | File |
|---|---|
| Types, error codes, constants | `src/lib/console-api.ts` |
| Typed client (shells + tests) | `src/lib/console-client.ts` |
| Deep-link mapping | `src/lib/console-links.ts` |
| Route helpers (auth, envelope, JSON body, 500 wrapper) | `src/server/console-api.ts` |

## Endpoints (v1, complete list)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/session/exchange` | device credential | 10A, unchanged behaviour |
| POST | `/session/logout` | session (optional) | 10A |
| GET | `/session` | staff session | **10B** — user, server-granted permissions, session kind/device, `issuedAt`, `endsAt` |
| GET | `/summary` | staff session | **10B** — attention counts + finance headline (finance permission only) |
| GET | `/devices` | staff session | 10A |
| POST | `/devices/register` | browser staff session | 10A |
| POST | `/devices/:id/rename` | owner / `staff` | 10A |
| POST | `/devices/:id/revoke` | owner / `staff` | 10A |

There is no pagination in v1 (devices are capped per user and returned whole).

## Success and error envelopes

Success: `{ "ok": true, ...payload }`, `Cache-Control: no-store`.

Error: `{ "ok": false, "code": "<CODE>", "message": "<Arabic UI text>", "field"?: "...", "retryAfter"?: <seconds> }`.

| Kind (client) | HTTP | Codes |
|---|---|---|
| unauthenticated | 401 | `UNAUTHENTICATED` (no / expired / revoked session, revoked device, demoted account) |
| forbidden | 403 | `FORBIDDEN` (role lacks permission, customer session, foreign Origin, device session registering) |
| invalid | 400 / 413 / 415 | `INVALID` (+ `field`), `INVALID_JSON`, `TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` |
| not_found | 404 | `NOT_FOUND` (also for devices the caller may not see) |
| conflict | 409 | `DEVICE_LIMIT`, `DEVICE_REVOKED` |
| throttled | 429 | `RATE_LIMITED` (+ `retryAfter`, `Retry-After` header) |
| server | 500 | `SERVER_ERROR` (no stack or internals) |
| network / timeout | — | raised by the client only |

Clients branch on the kind/code, never on `message`.

## `GET /summary`

```json
{ "ok": true, "generatedAt": "...", "timeZone": "Asia/Baghdad",
  "counts": { "orders": 3, "proofs": 1, "activations": 2, "renewals": 5, "resets": 0, "leads": 1, "tickets": 4 },
  "finance": { "currency": "IQD", "period": "month", "revenue": 0, "sales": 0, "previous": 0, "changePct": null,
               "netProfit": { "status": "incomplete" } },
  "unavailable": [] }
```

- Counts come from the same server functions as the console nav badges (`getQueueCounts`) and Console Home (`proofsAwaitingReview`); each key is present only if the role holds the permission of the nav item that shows that badge (orders/activations/leads/proofs → `orders`, renewals → `subscriptions`, resets → `customers`, tickets → `support`).
- `finance` is computed (Finance engine, this Baghdad month vs the same point last month) only for roles with `finance`; otherwise the key is absent.
- A source that fails is listed in `unavailable` — never reported as 0. There is no staff unread/notification count: the product has no staff notification data.

## Typed client

`createConsoleClient({ baseUrl, timeoutMs, fetch, headers, onUnauthenticated })` →
`session.exchange / logout / current`, `devices.list / register / rename / revoke`, `summary`.
Requests use `credentials: "include"` and `cache: "no-store"`; failures throw `ConsoleApiError { kind, status, code, field?, retryAfter? }`
(kinds above plus `network` / `timeout`). The client stores nothing; the credential from `register` is returned to the caller once,
for OS secure storage (Phase 10C/10D).

## Deep links

Canonical: the web URL on `https://shashtna.netlify.app`. Alias: `shashtna-console://<path without leading slash>`.

```
shashtna-console://admin                         → /admin
shashtna-console://admin/operations?queue=payments → /admin/operations?queue=payments
shashtna-console://admin/orders/42               → /admin/orders/42   (also …/orders/SH-000042)
shashtna-console://admin/customers/123           → /admin/customers/123
shashtna-console://admin/support/<ticket-uuid>   → /admin/support/<ticket-uuid>
```

Only existing `/admin` routes are mapped (`CONSOLE_ROUTES`); unknown routes, other schemes, path traversal and foreign origins map to
null (the shell opens `/admin`). Only page-relevant query keys are kept (`queue, period, from, to, view, q, status, page, scope`).
Destination pages still enforce permissions. `shashtna-console://` remains free (customer app: `shashtna://`; Player: none).
