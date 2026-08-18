-- RLS policies restrict which ROWS a role can see/touch; they do not by
-- themselves grant a role permission to attempt the operation at all.
-- CREATE TABLE only grants privileges to the table's owner - the three
-- tables added in earlier migrations never received explicit GRANTs,
-- so `authenticated` requests were failing with "permission denied"
-- before RLS ever got a chance to evaluate anything. This was caught by
-- running the RLS verification script against real authenticated
-- sessions rather than trusting the policy SQL alone.
--
-- Deliberately NOT granting anon: every policy on these tables is
-- scoped `to authenticated` only, so anon has no matching policy and
-- would see nothing regardless - there's no reason to also hand it a
-- table-level grant it can't use.
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.savings_goals to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

-- Prevents this exact bug from recurring silently if we ever add a new
-- table later in this migration project: any table subsequently created
-- by the same role executing this migration will automatically receive
-- these grants for `authenticated`.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
