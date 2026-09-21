# Database — Supabase (shared by both apps)

Farm City uses **one Supabase Postgres database**, shared by the two apps:

- **FARM-CITY** (the site + bot) writes orders as customers order.
- **automation** (the dashboard) reads and updates those same orders.

Both apps use the **same two connection strings**. You set them up once.

## 1. Create the Supabase project

1. Go to <https://supabase.com> → **New project**. Pick a name (e.g. `farm-city`),
   a strong **database password** (save it), and the region closest to Kenya
   (e.g. `eu-central-1` / `eu-west-*`).
2. Wait for it to provision.

## 2. Get the two connection strings

Supabase → **Project Settings → Database → Connection string → “URI”**. You need
two forms (toggle the mode):

| Env var | Which Supabase URL | Port |
| --- | --- | --- |
| `DATABASE_URL` | **Transaction** pooler, add `?pgbouncer=true` | 6543 |
| `DIRECT_URL` | **Session** / direct connection | 5432 |

They look like:

```ini
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

- The **pooled** URL (6543) is what the app uses at runtime — it survives
  serverless connection churn.
- The **direct** URL (5432) is what Prisma uses to run migrations.

Replace `<password>` with the DB password you chose (URL-encode any special
characters).

## 3. Put them in both apps

Set `DATABASE_URL` **and** `DIRECT_URL` in:

- FARM-CITY `.env` (local) and its Vercel project env vars
- automation `.env` (local) and its Vercel project env vars

Both apps point at the **same** database.

## 4. Create the tables and seed the catalogue (run once)

From the **FARM-CITY** repo (it owns the catalogue seed):

```bash
npm install
npx prisma migrate deploy   # applies prisma/migrations to Supabase
npm run seed                # loads products + zones from src/data/mockData
```

> The migration files are committed at `prisma/migrations/` and are identical in
> both repos. Run `migrate deploy` from **one** repo — it creates every table
> for both apps. `npm run seed` in FARM-CITY loads the catalogue; the
> **automation** seed only adds the order counter + an owner user, so running it
> is optional and never creates a competing catalogue.

## 5. Verify

- Supabase → **Table editor** should now list `Product`, `Order`, `Customer`, …
- `Product` should hold the storefront catalogue (≈151 rows).

## Notes

- **Migrations run from a machine that can reach Supabase** (your laptop or CI).
  Vercel's build runs `prisma generate` only, not `migrate deploy`, so apply
  migrations yourself (or add a deploy step) whenever the schema changes.
- **Keep the schema in sync:** `prisma/schema.prisma` and `prisma/migrations/`
  are duplicated in both repos and must stay identical. Change the schema in
  both, generate the migration once, and copy it to the other repo.
- **Free tier** is fine to start; a paused free project resumes on first
  connection. Move to a paid plan before launch.
