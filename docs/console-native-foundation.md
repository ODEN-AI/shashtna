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
