# Customer app ↔ website: sign-in handoff, app mode and update check

Chapter 2, customer app, step 2 (website side). The council's thin app (`docs/PROGRESS.md` → Decisions, 2026-11-14)
shows the website's own pages (store and checkout, points, the AI chat, tickets) inside the app, so they never fall
behind the site. This change lets those pages open already signed in, without the site's own chrome, and lets the
app ask customers to update (an APK never updates itself).

## Sign-in handoff

1. The app calls `POST /api/mobile/web-session` with its Bearer session → `{ code, expiresIn: 60 }`. Customers only
   (staff → 403).
2. The app's in-app browser **POSTs** a form `{ code, next }` to `/app/handoff` (the code is never in a URL).
3. `/app/handoff` checks the code (no code at all = a guest: app mode on, no session, straight to `next`), sets the normal website session cookie (`createAuthToken` + `setSessionCookie`,
   the same as a password sign-in), switches app mode on, and answers `303` to `next`. A bad or expired code, or a
   staff account, lands on `/login?redirect=<next>`.

The code (`src/lib/app-handoff.ts`) is an HMAC-signed `{ sub, iat, exp, n }` with its own purpose prefix: it expires
after 60 seconds, a handoff code can never be used as a session token, and the app's 30-day token can never be
posted as a code. It is not single-use within its 60 seconds (no table); it only ever travels in a POST body over
HTTPS between the app and the site. `next` is allow-listed (`safeNext`): `/dashboard`, `/plans`, `/checkout`,
`/orders`, `/receipts`, `/subscriptions`, `/points`, `/support`, `/account`, `/notifications`, `/help`, `/status`;
anything else (the console, other hosts, `//…`) becomes `/dashboard`.

## App mode

`/app/handoff` sets the cookie `shashtna_app=1` (not a credential; it only changes chrome). While it is set, the site
layout drops its header, footer, bottom navigation and entry effects, and the account layout drops its menus: the app
shows only the page, under its own navigation (`src/server/app-mode.ts`).

## Update check

Admin → Settings → «تطبيق شاشتنا للموبايل»: `app.latestVersion`, `app.minVersion` (x.y.z) and `app.downloadUrl`
(https). `GET /api/mobile/config` returns them additively as `customerApp: { latestVersion, minVersion, downloadUrl }`.
The app suggests an update when it is older than the latest version, and requires one when it is older than the
minimum.

## Code and tests

| File | Holds |
|---|---|
| `src/lib/app-handoff.ts` | `createHandoffCode`, `verifyHandoffCode`, `safeNext`, `APP_MODE_COOKIE` — `tests/app-handoff.test.ts` |
| `app/api/mobile/web-session/route.ts` | Issues the code |
| `app/app/handoff/route.ts` | Redeems it |
| `src/server/app-mode.ts`, `app/(site)/layout.tsx`, `app/(site)/(account)/layout.tsx` | App mode |
| `app/api/mobile/config/route.ts`, `src/server/settings.ts`, `src/lib/system.ts`, `app/admin/settings/page.tsx` | Update check |

No migration.
