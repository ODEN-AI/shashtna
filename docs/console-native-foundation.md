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

---

# Phase 10C-A — Android shell

Project: `shells/mobile` (Capacitor 8.5.2, own `package.json`/lockfile; excluded from the root tsconfig/ESLint). Build, layout and the
manual validation checklist: `shells/mobile/README.md`.

| | |
|---|---|
| Package / name | `com.shashtna.console` / «شاشتنا Console» (package needs approval before any store upload) |
| Loads | `https://shashtna.netlify.app/admin` (bundled `www/` only for the loading and offline pages) |
| Scheme | `shashtna-console://` (VIEW + BROWSABLE); App Links deferred until a custom domain exists |

## Session lifecycle (native layer only)

1. Launch: credential from the Keystore → `POST /session/exchange` → the server's `Set-Cookie` goes into the WebView cookie jar → load the Console.
2. Password sign-in in the WebView → on the next `/admin` page `GET /session`; a `browser` session → `POST /devices/register`
   (`platform: ANDROID`, label = device model, stored `deviceId` to re-bind; `DEVICE_REVOKED` → forget it and register anew) →
   Keystore → exchange at once, so the WebView holds a device session.
3. Resume (≥ 60 s since the last check): `GET /session`; 401 → exchange once → reload, else the sign-in page.
   If the device cookie (≤ 12 h) ends while in use and the Console shows `/login`, the shell exchanges once (≤ every 30 s) and returns.
4. Sign-out: the shell sees the Console's `POST /api/auth/logout`, first calls `POST /session/logout` with the current cookie and
   forgets the credential, then lets the Console's request through.
5. 401 → sign-in page · 403 → the Console's own "no permission" (never bypassed) · 429 → «حاول بعد N دقيقة» from `retryAfter` ·
   no network → offline page with retry. Not offline-first.

The credential is plaintext only in memory for the exchange body. It is never logged, put in a URL/header/cookie, given to the
WebView or JavaScript, or backed up (`allowBackup=false`, data-extraction rules exclude everything).

## WebView boundary

- No JavaScript bridge: Capacitor's `androidBridge` (web message listener / JS interface) is removed at startup and
  `server.allowNavigation` is empty, so remote pages get no plugin access.
- Navigation allow-list (`NavigationPolicy`): HTTPS on the Console host (default port) stays in the app; `https://localhost`
  is the bundled pages; `shashtna-console:` is resolved by `DeepLinkResolver`; other https/http sites, `tel:`, `mailto:`, `sms:`,
  `whatsapp:` open outside (only from a user action); `javascript:`, `file:`, `content:`, `intent:`, `data:`, cleartext Console,
  user-info or non-default ports are dropped.
- HTTPS only (network security config: no cleartext, system CAs only), mixed content never, file/content access off,
  geolocation off, no multiple windows, Safe Browsing on, WebView debugging off.

## Deep-link table

`scripts/console-routes.ts` writes `android/app/src/main/assets/console-routes.txt` from `CONSOLE_ROUTES`/`CONSOLE_QUERY_KEYS`;
`tests/console-contract.test.ts` fails if it is stale, and the JVM tests (`ConsoleShellTest`) repeat the web contract cases.

---

# Phase 10C-B — Windows shell

Project: `shells/desktop` (Tauri 2.12.1; own `package.json` for the CLI, Cargo workspace in `src-tauri`; excluded from the root
tsconfig/ESLint). Build, layout and the Windows validation checklist: `shells/desktop/README.md`.

| | |
|---|---|
| Identifier / name | `com.shashtna.console` / «شاشتنا Console» (`shashtna-console.exe`, NSIS per-user installer) |
| Loads | `https://shashtna.netlify.app/admin` (bundled `www/` only for the loading and offline pages) |
| Scheme | `shashtna-console://` (installer + per-user registration; single instance, warm links go to the open window) |

## Session lifecycle

Same flow as Android (logic in `src-tauri/core/src/session.rs`, tested with fakes):

1. Launch: credential from Windows Credential Manager → `POST /session/exchange` → the `Set-Cookie` goes into the WebView2 cookie
   store (host-only, HttpOnly, Secure) → load the Console.
2. Password sign-in → next `/admin` page: `GET /session` with the WebView2 cookie; a `browser` session → `POST /devices/register`
   (`platform: WINDOWS`, label `Windows · <PC name>`, stored `deviceId` to re-bind; `DEVICE_REVOKED` → register anew) →
   Credential Manager → exchange at once.
3. Window focus (≥ 60 s since the last check): `GET /session`; 401 → exchange once → reload, else the sign-in page. A Console
   redirect to `/login` while a credential is stored triggers one silent exchange (≤ every 30 s) and a return to the page.
4. Sign-out: a WebView2 `WebResourceRequested` filter holds the Console's `POST /api/auth/logout` (deferral) while the shell calls
   `POST /session/logout` with the current cookie (or, if none is left, with a native-only device session) and deletes the
   credential; the Console's request then continues unchanged.
5. 401 → sign-in page · 403 → the Console's own page (never bypassed) · 429 → native message from `retryAfter` · no network →
   offline page with retry. Not offline-first; no data cached by the shell; WebView2 form autofill off.

## WebView boundary

- No IPC surface: no commands, `app.security.capabilities: []`, no `withGlobalTauri`. Plugins (deep-link, single-instance, opener,
  dialog) are used from Rust only; their JavaScript commands are not permitted for any page.
- Navigation allow-list (`core/src/policy.rs`): HTTPS on the Console host (default port) stays in the window; `https://tauri.localhost`
  is the bundled pages; `shashtna-console:` is resolved by `core/src/links.rs` (WHATWG URL parser, same cases as the web test);
  other HTTPS sites, `mailto:`, `tel:` open in the default Windows handler; `http:`, `file:`, `javascript:`, `data:`, `blob:`,
  `about:`, unknown schemes, user info and non-default ports are dropped. `window.open` never creates a second window.
- Downloads only from the Console origin. File drops go to the page (native drag-drop handler disabled).
- Route table: `scripts/console-routes.ts` → `src-tauri/core/console-routes.txt`; `tests/console-contract.test.ts` checks it,
  `SESSION_COOKIE`, the platform value, the deep-link scheme and the empty capability list.

