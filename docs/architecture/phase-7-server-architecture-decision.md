# Architecture Decision: FinTrack's Server Role Post-Supabase-Migration

Status: **Approved**. Written at the end of the Mongo → Supabase migration's Phase 7, after Phases 1–6 replaced every Mongoose/Express responsibility with Postgres + Row Level Security + Supabase Auth.

## Context

Before this migration, FinTrack was a standard MERN app: React → Express → Mongoose → MongoDB, with a hand-written JWT/bcrypt auth system and per-controller ownership checks (`{user: req.user._id}`). Phases 1–6 replaced all of it:

- Postgres schema + RLS policies (Phases 1–3) replace the Mongoose models and the controllers' manual ownership filters.
- Supabase Auth (Phase 4) replaces the custom JWT/bcrypt system.
- Direct `supabase-js` CRUD from the React client (Phases 5–6) replaces every Express route.

At the end of that work, `server/` still physically exists but nothing in the client calls it anymore. Phase 7 asked: what, if anything, should remain server-side?

## Classification of `server/`'s responsibilities at the end of Phase 6

| File / responsibility | Category |
|---|---|
| `models/User.js`, `models/Expense.js`, `models/SavingsGoal.js` | Obsolete — Supabase replaced it (`auth.users`, `public.expenses`, `public.savings_goals`) |
| `controllers/authController.js`, `middleware/authMiddleware.js` | Obsolete — Supabase Auth replaced it |
| `controllers/expenseController.js`, `controllers/savingsGoalController.js` | Obsolete — direct client CRUD + RLS replaced it |
| `routes/*.js` | Obsolete — thin wiring around now-obsolete controllers |
| `app.js` (route mounting, `mongoose.connect`, `app.listen`) | Obsolete — nothing left to mount or connect to |
| `.env.example` (`MONGO_URI`, `JWT_SECRET`, `PORT`) | Obsolete as currently documented |
| `mongoose`, `bcryptjs`, `jsonwebtoken` | Obsolete — no Mongo connection, no password hashing, no custom token issuance/verification left |
| `express`, `cors`, `dotenv`, `nodemon` | Generic tooling, not a "responsibility" — reusable only if a server is kept for some other reason |

Notably: in this codebase, "obsolete because Supabase replaced it" and "dead code that can safely be removed" are the same set. Nothing in `server/` fell into "still potentially useful server-side" or "should move to another trusted mechanism" — FinTrack has no email sending, payment processing, third-party API secrets, scheduled jobs, or admin operations. The entire feature set turned out to be fully expressible as user-owned CRUD under RLS.

## The three trusted-backend patterns

A clarification made explicit here because it's easy to conflate "uses a server" with "bypasses RLS" — they are not the same thing:

1. **Direct**: React → Supabase, using the authenticated user's own JWT. RLS evaluates `auth.uid()` against that JWT for every request. This is what Phases 4–6 built.
2. **Backend-forwarded-JWT**: React → a trusted backend → Supabase, where the backend still acts *as the user* (forwarding or re-deriving their JWT) rather than using a privileged credential. RLS still applies exactly as in pattern 1. A backend here exists for some *other* reason — e.g., orchestrating a call to a third-party API whose key can't live in the browser — not to escape RLS.
3. **Backend-with-secret**: React/webhook/scheduled job → a trusted backend → Supabase, using a secret/admin credential that intentionally bypasses RLS. Reserved for operations that cannot be scoped to one authenticated user's own data: cross-user admin actions, webhook handlers with no user session at all (e.g., a payment provider's webhook), scheduled jobs, bulk operations.

**Rule going forward**: prefer pattern 1. If a trusted backend is needed for some other reason, prefer pattern 2 over pattern 3 — keep RLS enforcing ownership even when a server is in the request path. Reach for pattern 3 only when the operation genuinely cannot be scoped to a single user's own data. This is the actual discipline that keeps a "hybrid" architecture from quietly regressing into "just route everything through a privileged credential," which is the same class of risk the whole migration moved away from.

## Terminology note

This document uses Supabase's current key terminology: **publishable key** (`sb_publishable_...`) for client-side use, **secret key** (`sb_secret_...`) for privileged server-side use (pattern 3). The legacy names `anon` and `service_role` refer to the same two roles respectively and still function today, but are being phased out — noted here only so this document cross-references correctly with older Supabase docs/tutorials that use the legacy names.

## Architecture options compared (summary — full comparison in Phase 7 discussion)

| | React → Supabase directly | React → Express → Supabase | Hybrid (hold pattern 1 as default; add pattern 2/3 only when needed) |
|---|---|---|---|
| Security | RLS is the sole enforcement layer, exhaustively tested (Phases 3, 5, 6) | Re-introduces custom-authorization risk unless carefully built as pattern 2 | RLS stays authoritative; a small, deliberately-scoped trusted surface exists only for genuine pattern-3 needs |
| Complexity | Lowest | Higher — second codebase, API contract | Grows only with actual privileged surface, not preemptively |
| Deploy/maintenance cost | Lowest — no server process | Real ongoing hosting/patching/monitoring cost | Scales with need — could be near-zero (a couple of Edge Functions) |
| Becomes necessary when | N/A | Every operation needs custom logic RLS can't express | The moment a genuine pattern-3 operation appears |
| Fits FinTrack today | Excellent — nothing privileged exists | Poor — pure regression for no current benefit | Excellent, and the more honest long-term framing |
| Transferability to a future commercial SaaS | High for the owned-data slice, but rarely survives unchanged once billing/email/admin appear | Familiar, but not what mature Supabase-based products converge on | Highest — RLS-first, add a minimal trusted surface deliberately when a specific need shows up |

## Decision

Adopt the **hybrid model as the standing architecture rule**. Applied to FinTrack *today*, this means operating as pattern 1 only (direct React → Supabase, RLS-enforced) — no server runs, because the classification above shows no current responsibility needs one. `server/`'s Express/Mongoose/custom-auth code is being removed (Phase 8), not kept idle "just in case." The rule is recorded here so that the day a genuine privileged operation appears (a payment webhook, a third-party API secret, a scheduled job, an admin bulk action), the default reflex is pattern 2 first, pattern 3 only when the operation specifically requires bypassing RLS — not "stand up a server and route everything through it."
