-- updated_at is the sync cursor, so it must come from the server clock, not
-- from whatever a client sends. Run with: npx supabase test db
create extension if not exists pgtap with schema extensions;

begin;
select plan(6);

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'alice@example.com');

insert into public.groups (id, name, default_currency, created_by, created_at, updated_at)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Budapest Trip',
  'EUR',
  '11111111-1111-1111-1111-111111111111',
  now(),
  -- A device whose clock is a year fast.
  '2027-01-01T00:00:00Z'
);

select ok(
  (select updated_at from public.groups where id = 'aaaaaaaa-0000-0000-0000-000000000001')
    < now() + interval '1 minute',
  'a future client timestamp is discarded on insert'
);

insert into public.group_members (id, group_id, display_name, color, user_id, created_at, updated_at)
values (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Alice', '#2563eb', '11111111-1111-1111-1111-111111111111',
  now(),
  -- A device whose clock is five minutes slow, the case that loses writes.
  now() - interval '5 minutes'
);

select ok(
  (select updated_at from public.group_members where id = 'bbbbbbbb-0000-0000-0000-000000000001')
    > now() - interval '1 minute',
  'a stale client timestamp is discarded on insert'
);

insert into public.transactions (
  id, group_id, type, amount, currency, description, occurred_at,
  payer_member_id, created_at, updated_at
)
values (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'expense', 10.00, 'EUR', 'Pizza', now(),
  'bbbbbbbb-0000-0000-0000-000000000001', now(), '2000-01-01T00:00:00Z'
);

create temp table before_update as
select updated_at from public.transactions
where id = 'cccccccc-0000-0000-0000-000000000001';

update public.transactions
set description = 'Pizza and beer', updated_at = '2000-01-01T00:00:00Z'
where id = 'cccccccc-0000-0000-0000-000000000001';

select ok(
  (select updated_at from public.transactions where id = 'cccccccc-0000-0000-0000-000000000001')
    > (select updated_at from before_update),
  'an update moves updated_at forward even when the client sends an old one'
);

-- now() is fixed for the whole transaction, so only clock_timestamp() can make
-- two writes in one transaction distinguishable to a cursor.
select ok(
  (select updated_at from public.transactions where id = 'cccccccc-0000-0000-0000-000000000001')
    <> (select updated_at from public.groups where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'writes in the same transaction get distinct timestamps'
);

-- created_at stays client-owned: it is shown to the user, never used to sync.
select is(
  (select created_at from public.transactions where id = 'cccccccc-0000-0000-0000-000000000001')::date,
  now()::date,
  'created_at is left as the client sent it'
);

select has_index(
  'public', 'transactions', 'transactions_cursor_idx',
  array['group_id', 'updated_at', 'id'],
  'the cursor is indexed as a whole, including the id tiebreaker'
);

select * from finish();
rollback;
