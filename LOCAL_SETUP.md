# Shashtna 2.0 — Local setup

This guide gets the website running on your own machine, from a clean
checkout (or the source ZIP) to a working production build.

## Requirements

| Tool       | Version                         |
| ---------- | ------------------------------- |
| Node.js    | 22 or newer (tested on 22.22)   |
| npm        | 10 or newer (ships with Node)   |
| PostgreSQL | 15 or newer (tested on 16)      |
| Git        | any recent version (optional)   |

## 1. Get the source

Either clone the branch:

```bash
git clone <your-repository-url> shashtna
cd shashtna
git checkout claude/shashtna-modern-2-0
```

or unzip `Shashtna-Website-2.0-Source.zip` and `cd` into the folder. To check
the ZIP was not altered, compare its checksum with the `.sha256` file:

```bash
sha256sum -c Shashtna-Website-2.0-Source.zip.sha256
```

## 2. Install dependencies

```bash
npm install
```

`postinstall` runs `prisma skills sync`. If it fails (for example offline) the
install still succeeds; it only refreshes editor/agent docs.

## 3. Create the database

Create an empty PostgreSQL database, for example:

```bash
createdb shashtna_dev
# or: psql -U postgres -c "CREATE DATABASE shashtna_dev"
```

## 4. Configure `.env`

```bash
cp .env.example .env
```

Then edit `.env`:

- `DATABASE_URL` — connection string for the database from step 3, e.g.
  `postgresql://postgres:postgres@127.0.0.1:5432/shashtna_dev`.
- `AUTH_SECRET` — any random string of **at least 32 characters**. Generate one:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

- `SHASHTNA_STORAGE` — optional; leave unset locally (see Common issues).

Use `.env` rather than only `.env.local`: the Prisma CLI reads `.env`, while
Next.js reads both. Never commit either file.

## 5. Prisma: generate the contract and apply migrations

The generated contract (`src/prisma/contract.json` / `contract.d.ts`) is
committed, so this step is only needed after editing `src/prisma/contract.prisma`:

```bash
npm run contract:emit
```

Apply all migrations to your database:

```bash
npx prisma db migrate --db "$DATABASE_URL" --yes
npx prisma db verify --db "$DATABASE_URL"
```

(On Windows PowerShell use `$env:DATABASE_URL`, or paste the URL directly.)

`db verify` should report "Database marker and schema match contract".

### Upgrading an existing Shashtna database

The 2.0 migration (`migrations/app/20260925T0442_modern_shashtna_2_0`) is
**additive only**: it adds nullable/defaulted columns and new tables and never
drops or rewrites existing data. Take a backup first anyway:

```bash
pg_dump "$DATABASE_URL" > shashtna-backup.sql
npx prisma db migrate --db "$DATABASE_URL" --yes
```

Old order statuses (`PENDING`, `ACCEPTED`) keep working: the app reads them as
`SUBMITTED` and `COMPLETED`.

## 6. Run the development server

```bash
npm run dev
```

Open http://localhost:3000.

### Create the first admin

1. Register a normal account at http://localhost:3000/register.
2. Promote it to owner in the database (use the phone number you registered):

   ```sql
   UPDATE "user" SET role = 'OWNER' WHERE phone = '07XXXXXXXXX';  -- exactly as typed at sign-up
   ```

3. Sign out and back in, then open http://localhost:3000/admin.

Further staff (Operator, Support, Content) can be managed from
**Admin → System → Admins & roles** (`/admin/admins`) once you are signed in as owner.

## 7. Production build

```bash
npm run build
npm start          # serves on http://localhost:3000
```

`npm start -- -p 4000` picks another port.

## 8. Checks

```bash
npx tsc --noEmit   # type check
npm run lint       # ESLint
npm test           # unit tests (Node test runner)
```

`npm run lint` still reports errors in a few legacy admin editors
(`app/admin/packages`, `devices`, `apps`, `subscriptions`,
`app/api/admin/devices`). They predate 2.0 and do not affect the build.

## Common issues

| Symptom | Fix |
| ------- | --- |
| `DATABASE_URL is not configured` during `npm run build` | The build renders pages that read the database. Set `DATABASE_URL` in `.env` before building. |
| `AUTH_SECRET must be configured and contain at least 32 characters` | Set a longer `AUTH_SECRET`. Changing it signs everyone out. |
| Text shows in a fallback font | Thmanyah Sans is loaded from `cdn.jsdelivr.net` (see the first line of `app/globals.css`). Check your network or firewall allows it. |
| Support tickets or image uploads fail locally | Storage is chosen automatically: local files outside Netlify, Netlify Blobs on Netlify. Force local files with `SHASHTNA_STORAGE=local`. Tickets are written to `.data/`, uploads to `public/uploads/`; both are git-ignored. |
| `MIGRATION.*` error from `prisma db migrate` | Make sure the database is empty or was created by an earlier Shashtna migration. Run `npx prisma db verify --db "$DATABASE_URL"` to see what differs. |
| Port 3000 already in use | `npm run dev -- -p 3001` |
| `/admin` shows "not allowed" | Your account role is `CUSTOMER`. Promote it (step 6) and sign in again. |

## What is not included

- No `.env`, database dumps or credentials are shipped. Bring your own.
- `node_modules`, `.next` and uploaded files are excluded from the ZIP.
