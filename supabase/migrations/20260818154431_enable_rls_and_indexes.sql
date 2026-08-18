alter table public.expenses enable row level security;
alter table public.savings_goals enable row level security;
alter table public.profiles enable row level security;

-- Policies are scoped explicitly `to authenticated` rather than left to
-- apply to every role. Functionally, an unauthenticated request would
-- already see zero rows either way (auth.uid() is null for the anon
-- role, and null = user_id is never true) - but scoping the role
-- explicitly means Postgres skips evaluating this policy for anon
-- requests entirely, rather than relying on "the comparison happens to
-- evaluate false" as the only thing standing between anon and the data.
-- Explicit default-deny, not an accidental one.
--
-- auth.uid() is wrapped in `(select ...)` per current Supabase RLS
-- performance guidance: this lets Postgres evaluate it once per query
-- (an initPlan) instead of once per row. Combined with the index below,
-- this is what keeps RLS cheap as these tables grow.

create policy "expenses_owner_all" on public.expenses
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "savings_goals_owner_all" on public.savings_goals
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- profiles.id IS the user's auth id (FK/PK to auth.users), so ownership
-- is expressed against id, not a separate user_id column.
--
-- SECURITY NOTE for future schema changes: this policy grants full
-- read/write on every column of a profile to its owner. That's fine
-- while profiles only holds non-privileged data (name). RLS is
-- row-level, not column-level - "owns the row" does not imply "may
-- write every column of the row." If a privileged column is ever added
-- here (role, is_admin, subscription_tier, plan_expires_at, etc.), this
-- policy as written would let a user set it on themselves via a normal
-- UPDATE. Before adding any such column, revisit this: options include
-- moving privileged fields to a separate table with a stricter policy
-- (no user-facing UPDATE policy at all - changes only via a
-- SECURITY DEFINER function or a service-role-only path), Postgres
-- column-level privileges, or a trigger rejecting changes to protected
-- columns from non-privileged callers.
create policy "profiles_owner_all" on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- RLS's `using` clause effectively adds `user_id = auth.uid()` to every
-- query Postgres plans against expenses. Without an index, that's a
-- full table scan per request as data grows. Composite with date DESC
-- also matches the app's real query pattern (GET /expenses, newest
-- first).
create index expenses_user_id_date_idx on public.expenses (user_id, date desc);

-- No new index needed elsewhere: savings_goals.user_id already has a
-- unique index from Phase 1's `unique` constraint, and profiles.id is
-- already indexed as the primary key.
