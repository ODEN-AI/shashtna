# Phone push notifications (customer app)

Chapter 2 (apps), step 1 — chosen by the council on 2026-11-14 (see `docs/PROGRESS.md` → Decisions): the customer
app ([`ODEN-AI/shashtna-mobile`](https://github.com/ODEN-AI/shashtna-mobile)) becomes a thin native app, and the
first thing that must work is push, before the first renewals in December.

## What it does

Every in-app notification the site creates for a customer — payment confirmed, activation, renewal reminders
(T-5 / T-0 / T+3), support and chat replies, points, digital-platform delivery… — is **also sent to that customer's
phones** that installed the app and allowed notifications. Same title, text and link; nothing new is written. The
app opens the link's screen when the push is tapped (`{ notificationId, type, link }`), and files it under one of
its three Android channels (`account`, `service`, `offers`, from the notification type).

## Switch

`push.enabled` (Admin → Settings → «إشعارات الهواتف»), **off by default**, owner only, audited
(`PUSH_SETTINGS_CHANGED`). The page shows how many phones are registered (a count, never tokens). Off: phones still
register, nothing is sent.

## Data

Table `pushDevice` (migration `20261114T0009_push_devices`, additive): `userId`, `token` (unique Expo push token),
`platform` (ANDROID | IOS), `deviceName`, `appVersion`, `isActive`, `lastSeenAt`, `lastError`, timestamps. A token
moves to whoever registers it last (one phone, one account at a time). Sign-out or Expo's `DeviceNotRegistered`
switches it off; rows are kept. Tokens are never logged or shown in full (`maskToken`).

## API (additive)

| Endpoint | Change |
|---|---|
| `POST /api/mobile/devices` `{ token, platform, deviceName?, appVersion? }` | Now stores the token: `{ deviceId: <number>, push: "ACTIVE" \| "OFF" }` (was `deviceId: null`); a bad token or platform → 400 `INVALID` |
| `DELETE /api/mobile/devices` `{ token }` | Switches that phone off for the signed-in account |

## Sending

`notify()` (`src/server/notifications.ts`) calls `sendPushForNotification` right after it creates a notification (a
deduplicated repeat creates nothing and sends nothing). It posts to the Expo Push Service
(`https://exp.host/--/api/v2/push/send`, batches of 100, 5-second timeout, optional `EXPO_ACCESS_TOKEN`), reads the
tickets, switches off gone tokens and records other errors on the device. It never throws: a push failure never
breaks the notification.

Not done yet: Expo receipts (the second delivery check) and retries of failed pushes; push only reaches customers
who use the app — the in-app notifications and the owner's WhatsApp links from «اليوم» remain the fallback.

## Code

| File | Holds |
|---|---|
| `src/lib/push.ts` | Token and body checks, channels, messages, batches, ticket reading — `tests/push.test.ts` |
| `src/server/push.ts` | `registerDevice`, `unregisterDevice`, `countActiveDevices`, `pushEnabled`, `sendPushForNotification` |
| `app/api/mobile/devices/route.ts` | Registration and sign-out |
| `scripts/integration/push.mts` | Local-database check with a fake Expo sender |

## Deploy order

`notify()` reads `pushDevice` on every new notification once the switch is on, and the devices route writes it, so
**apply migration `20261114T0009_push_devices` to production first (owner approval), then merge**. Leave the switch
off until a test phone has the app.
