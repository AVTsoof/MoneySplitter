-- Mirrors web/src/data/schema.ts. Column names are snake_case here and camelCase
-- in Dexie; the sync layer adapts between them.
--
-- Money is numeric(18,2). PostgREST serialises numeric as a JSON number, which
-- would break the "money is never a number" rule, so reads must cast:
--   .select('id, amount::text, ...')

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key,
  name text not null,
  default_currency text not null,
  active_currencies text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index groups_updated_at_idx on public.groups (updated_at);

create table public.group_members (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  display_name text not null,
  color text not null,
  -- Null until a signed-in user claims this member via an invite.
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (group_id, display_name)
);

-- The unique constraint above indexes group_id but not user_id, and every
-- policy filters on user_id.
create index group_members_user_id_idx on public.group_members (user_id);

create table public.transactions (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  type text not null check (type in ('expense', 'transfer')),
  amount numeric(18, 2) not null,
  currency text not null,
  description text not null default '',
  occurred_at timestamptz not null,
  payer_member_id uuid references public.group_members (id) on delete restrict,
  sender_member_id uuid references public.group_members (id) on delete restrict,
  receiver_member_id uuid references public.group_members (id) on delete restrict,
  split_strategy jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint transactions_expense_has_payer check (
    type <> 'expense' or payer_member_id is not null
  ),
  constraint transactions_transfer_has_parties check (
    type <> 'transfer'
    or (sender_member_id is not null and receiver_member_id is not null)
  )
);

create index transactions_group_id_idx on public.transactions (group_id);
create index transactions_group_occurred_idx on public.transactions (group_id, occurred_at);
create index transactions_group_updated_idx on public.transactions (group_id, updated_at);

-- Shares have no updated_at of their own: they are replaced wholesale whenever
-- their parent transaction changes, and the parent's updated_at is the cursor.
create table public.transaction_shares (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete restrict,
  amount numeric(18, 2) not null,
  primary key (transaction_id, member_id)
);

create index transaction_shares_member_id_idx on public.transaction_shares (member_id);

create table public.exchange_rates (
  base text primary key,
  rates jsonb not null,
  fetched_at timestamptz not null
);

create table public.group_invites (
  token text primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index group_invites_group_id_idx on public.group_invites (group_id);

-- Every signed-in user gets a profile row; the client never inserts one.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
