-- RLS for groups and group_members: everything is gated on "is the caller a
-- member of this group". Run with: npx supabase test db
create extension if not exists pgtap with schema extensions;

begin;
select plan(7);

-- Fixtures run as postgres, which owns the tables and so bypasses RLS.
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
values (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Alice',
  '#2563eb',
  '11111111-1111-1111-1111-111111111111',
  now(),
  now()
);

-- Alice, a member ------------------------------------------------------------

set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select id from public.groups $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$,
  'a member reads their own group'
);

select results_eq(
  $$ select display_name from public.group_members $$,
  $$ values ('Alice'::text) $$,
  'a member reads the group roster'
);

-- Bob, not a member ----------------------------------------------------------

reset role;
set local "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select id from public.groups $$,
  'an outsider sees no groups'
);

select is_empty(
  $$ select id from public.group_members $$,
  'an outsider sees no members'
);

select throws_ok(
  $$
    insert into public.group_members (id, group_id, display_name, color, created_at, updated_at)
    values (
      'bbbbbbbb-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'Mallory', '#f59e0b', now(), now()
    )
  $$,
  '42501',
  null,
  'an outsider cannot add themselves to a group'
);

-- A using clause filters rows out rather than raising, so the write silently
-- matches nothing. Prove both halves: no rows changed, and the row survived.
select is_empty(
  $$ update public.groups set name = 'Hijacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id $$,
  'an outsider updates no group rows'
);

reset role;

select is(
  (select name from public.groups where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Budapest Trip',
  'the group name survived the outsider write'
);

select * from finish();
rollback;
