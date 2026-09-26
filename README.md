# Shashtna (شاشتنا)

The Shashtna website: plans, checkout, the customer area (My Shashtna), help
centre and the staff operations console. Arabic-first (RTL), dark UI, set in
Thmanyah Sans.

To run it locally, see **[LOCAL_SETUP.md](LOCAL_SETUP.md)**.

## Stack

- Next.js 16 (App Router, server components and server actions)
- React 19, Tailwind CSS v4
- Prisma Next 8 on PostgreSQL (`src/prisma/contract.prisma`, migrations in `migrations/app`)
- Netlify Blobs for support tickets and uploads when deployed on Netlify

## Layout

| Path | What it holds |
| ---- | ------------- |
| `app/(site)` | Public pages: home, plans, Watch On (`/apps`, `/devices`, `/watch`), help, status, legal, auth, checkout |
| `app/(site)/(account)` | My Shashtna: dashboard, subscriptions, orders, receipts, support, account, notifications |
| `app/admin` | Operations console: inbox, orders, activations, renewals, customers, support, content, insights, system |
| `app/api` | JSON APIs used by the site, the admin and the Shashtna Player app |
| `app/ui` | Design system components |
| `src/lib` | Pure domain logic: roles, order state machine, subscription state, i18n, sessions |
| `src/server` | Server-only services: orders, subscriptions, notifications, settings, content |
| `src/content` | Help, FAQ and legal copy |
| `tests` | Unit tests (`npm test`) |

## Scripts

| Command | Does |
| ------- | ---- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests |
| `npm run test:integration` | API + service tests against the database in `DATABASE_URL` (use a test database) |
| `npm run lint` | ESLint |
| `npm run contract:emit` | Regenerate the Prisma contract after editing `contract.prisma` |

## Notes

- Sessions are HttpOnly signed cookies (website) or Bearer tokens (mobile);
  admin access is checked on the server against the role stored in the database.
- Sign-in locks for 15 minutes after 5 wrong passwords (website and app).
  Tokens carry `user.tokenVersion`: a password change or reset, or "sign out
  on all devices" in the app, ends every other session and deactivates the
  account's push devices.
- The checkout confirmation is resolved by `src/server/checkout.ts`, shared by
  the website checkout and the mobile app.
- Payment is arranged manually with the Shashtna team; the site records orders
  and their status but does not take payments online.
- Legal pages are drafts and have not been reviewed by a lawyer.

## Mobile app

The Shashtna mobile app ([ODEN-AI/shashtna-mobile](https://github.com/ODEN-AI/shashtna-mobile))
uses this backend as its only source of truth, through `app/api/mobile/*`
(Bearer token, same accounts). Announcements and offers are the same
`Announcement` records (target `ALL` or `MOBILE`); notifications are the same
`Notification` records.

- **Push**: every notification written by `notify()` is also pushed to the
  customer's registered phones through the Expo Push Service (FCM/APNs).
  Devices live in `PushDevice`; delivery receipts in `PushTicket`.
- **Admin → إشعارات الهواتف** (`/admin/notifications`): draft, send now,
  schedule, cancel; audiences: everyone, one customer, active subscribers,
  expiring, open orders, awaiting payment. Offers only reach customers who
  opted in. Permissions: `notifications` (one customer) and `broadcast`.
- **Scheduler**: `netlify/functions/push-dispatch.mts` calls `/api/cron/push`
  every 5 minutes (scheduled campaigns, renewal reminders, push receipts).
  Set `CRON_SECRET` on the site; `EXPO_ACCESS_TOKEN` only if enhanced push
  security is enabled on expo.dev.
