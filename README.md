# fintrack-ai-lab

FinTrack V2 — a personal budgeting and wallet web application.

This repo continues development from the original [FinTrack](https://github.com/otaviovaleriano/FinTrack) project. It was also used as a guided learning project for migrating a MERN app (MongoDB/Express/React/Node with a custom JWT auth system) to Supabase (Postgres + Auth + Row Level Security).

## Architecture

FinTrack is a React client that talks to Supabase directly — there is no backend server. Every responsibility a typical Express API would handle is covered by Supabase instead:

- **Identity**: Supabase Auth (`auth.users`) handles signup/login/session management. A `public.profiles` table holds app-specific user data (currently just `name`), created automatically on signup via a database trigger.
- **Data**: `public.expenses` and `public.savings_goals` are plain Postgres tables, queried directly from the client via [`@supabase/supabase-js`](https://github.com/supabase/supabase-js).
- **Authorization**: application-data authorization is enforced at the database layer through explicit table privileges and Row Level Security (RLS) policies, with RLS providing per-user row isolation — every table is scoped so a user can only ever see or modify their own rows. There is no server-side authorization code to audit; the database is the enforcement point.

This "no backend" architecture is a deliberate decision, not an oversight — see [`docs/architecture/phase-7-server-architecture-decision.md`](docs/architecture/phase-7-server-architecture-decision.md) for the full reasoning, including when a trusted backend *would* become necessary (privileged operations, third-party secrets, webhooks) and the three distinct patterns for adding one without regressing away from RLS-based authorization.

Known cleanup items and a tracked functional bug are documented in [`docs/known-issues.md`](docs/known-issues.md).

## Environment setup

The client needs two environment variables, both safe to expose in the browser bundle by design (Row Level Security, not key secrecy, is what protects the data):

```bash
cp client/.env.example client/.env
```

Then fill in `client/.env` with your Supabase project's values (Project Settings → API in the Supabase dashboard):

- `REACT_APP_SUPABASE_URL` — your project's API URL (`https://<project-ref>.supabase.co`), **not** the dashboard management URL.
- `REACT_APP_SUPABASE_PUBLISHABLE_KEY` — the publishable key (`sb_publishable_...`). This replaces the legacy `anon` key terminology; if your project still shows the legacy name, it's the same key.

Never put a **secret key** (`sb_secret_...`, formerly `service_role`) in `client/.env` or anywhere in `client/` — it bypasses RLS entirely and must never reach the browser.

## Local development

```bash
npm install          # root
npm install --prefix client
npm run dev           # runs the React client (react-scripts start)
```

There is no separate server process to start — `npm run dev` is the whole local dev environment.

## Supabase migrations / setup

Schema changes live as SQL files in `supabase/migrations/`, applied via the Supabase CLI (installed as a root devDependency, so it's run via `npx`):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies any pending migrations
npx supabase migration new <name>   # scaffold a new migration
```

Worth knowing: this project was developed against the linked remote Supabase project directly, without a local Docker-based dev loop (`supabase start`). That's a deliberate characteristic of how it was built — Docker wasn't available in the development environment — not a recommendation against using one. If you have Docker available, `supabase start` + `supabase db reset` gives a faster, safer local iteration loop before pushing to the remote project.

## Auth / RLS model

- Users sign up/log in through Supabase Auth (`supabase.auth.signUp` / `signInWithPassword`), handled in `client/src/pages/LoginPage.jsx`.
- `client/src/UserContext.jsx` tracks the session reactively (`onAuthStateChange`) and separately fetches the matching `profiles` row — a profile-fetch failure never invalidates a valid session.
- Every table containing user-owned data (`expenses`, `savings_goals`, `profiles`) has RLS enabled with an ownership policy (`auth.uid() = user_id`, or `auth.uid() = id` for `profiles`), scoped explicitly `to authenticated`.
- The client never filters queries by user manually (e.g. no `.eq('user_id', ...)` on reads) — authorization is enforced at the database layer through table privileges and RLS together, not a client-side belt-and-suspenders check.

## Testing

There's no traditional test suite yet, but `scripts/verify-rls.mjs` is a real security regression test: it signs in as two actual Supabase users via `@supabase/supabase-js` (not database-owner queries, which would bypass RLS and prove nothing) and exercises the full CRUD ownership matrix against `expenses` and `savings_goals` — insert/select/update/delete for each user's own rows, cross-user isolation in both directions, a forged-`user_id` insert to prove `WITH CHECK` specifically, and unauthenticated access — plus SELECT/UPDATE isolation on `profiles`.

To run it, you need two existing Supabase users (see the script for the expected test emails) and their passwords set as environment variables in your own shell — never paste passwords into a chat or commit them:

```bash
$env:USER_A_PASSWORD="..."
$env:USER_B_PASSWORD="..."
node scripts/verify-rls.mjs
```

Re-run this any time an RLS policy changes on `expenses`, `savings_goals`, or `profiles`, to confirm isolation still holds. It's currently hardcoded to those three tables; extending it to a new table would mean adding another call to the script's `testTableIsolation` helper.
