-- profiles: 1-to-1 extension of auth.users, holding app-specific data
-- that does not belong on Supabase's managed auth.users table.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Fires after every new auth.users row, creating the matching profile.
-- Intentionally fail-closed: no exception handling here. If this insert
-- fails, the triggering auth.users insert is rolled back with it, so
-- signup fails outright rather than leaving an orphaned auth identity
-- with no profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
