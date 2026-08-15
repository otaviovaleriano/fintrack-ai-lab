-- expenses: many-to-one with auth.users
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text,
  description text,
  amount numeric(12, 2) not null,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- savings_goals: one-to-one with auth.users
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Replicates Mongoose's automatic updatedAt maintenance, which Postgres
-- does not do by default.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row
  execute function public.set_updated_at();

create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row
  execute function public.set_updated_at();
