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
| `npm run lint` | ESLint |
| `npm run contract:emit` | Regenerate the Prisma contract after editing `contract.prisma` |

## Notes

- Sessions are HttpOnly signed cookies (website) or Bearer tokens (mobile);
  admin access is checked on the server against the role stored in the database.
- Payment is arranged manually with the Shashtna team; the site records orders
  and their status but does not take payments online.
- Legal pages are drafts and have not been reviewed by a lawyer.
