-- RLS for transactions and transaction_shares, including the absence of a
-- delete grant: deletes must be soft. Run with: npx supabase test db
create extension if not exists pgtap with schema extensions;

begin;
select plan(9);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

insert into public.groups (id, name, default_currency, created_by, created_at, updated_at)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Budapest Trip',
  'EUR',
  '11111111-1111-1111-1111-111111111111',
  now(),
  now()
);

insert into public.group_members (id, group_id, display_name, color, user_id, created_at, updated_at)
values
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Alice', '#2563eb', '11111111-1111-1111-1111-111111111111', now(), now()
  ),
  -- A guest with no account still appears on bills; user_id stays null.
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Dana', '#7c3aed', null, now(), now()
  );

insert into public.transactions (
  id, group_id, type, amount, currency, description, occurred_at,
  payer_member_id, created_at, updated_at
)
values (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'expense', 10.00, 'EUR', 'Pizza', now(),
  'bbbbbbbb-0000-0000-0000-000000000001', now(), now()
);

insert into public.transaction_shares (transaction_id, member_id, amount)
values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 5.00),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 5.00);

-- Alice, a member ------------------------------------------------------------

set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select description from public.transactions $$,
  $$ values ('Pizza'::text) $$,
  'a member reads the group bills'
);

select is(
  (select count(*) from public.transaction_shares),
  2::bigint,
  'a member reads both shares of the bill'
);

select results_eq(
  $$
    insert into public.transactions (
      id, group_id, type, amount, currency, description, occurred_at,
      payer_member_id, created_at, updated_at
    )
    values (
      'cccccccc-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'expense', 20.00, 'EUR', 'Taxi', now(),
      'bbbbbbbb-0000-0000-0000-000000000001', now(), now()
    )
    returning description
  $$,
  $$ values ('Taxi'::text) $$,
  'a member adds a bill'
);

-- No delete grant exists, so a hard delete fails for members too.
select throws_ok(
  $$ delete from public.transactions where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'even a member cannot hard-delete a bill'
);

-- Bob, not a member ----------------------------------------------------------

reset role;
set local "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select id from public.transactions $$,
  'an outsider sees no bills'
);

select is_empty(
  $$ select transaction_id from public.transaction_shares $$,
  'an outsider sees no shares'
);

select throws_ok(
  $$
    insert into public.transactions (
      id, group_id, type, amount, currency, description, occurred_at,
      payer_member_id, created_at, updated_at
    )
    values (
      'cccccccc-0000-0000-0000-000000000003',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'expense', 999.00, 'EUR', 'Forged', now(),
      'bbbbbbbb-0000-0000-0000-000000000001', now(), now()
    )
  $$,
  '42501',
  null,
  'an outsider cannot add a bill to a group'
);

select is_empty(
  $$
    update public.transactions set deleted_at = now()
    where id = 'cccccccc-0000-0000-0000-000000000001'
    returning id
  $$,
  'an outsider updates no bill rows'
);

reset role;

select is(
  (select deleted_at from public.transactions where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'the bill survived the outsider write'
);

select * from finish();
rollback;
