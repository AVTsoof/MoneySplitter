-- Authorisation model: docs/authorization.md.
-- The client talks to Postgres directly, so the database is the security
-- boundary. Grants and policies are both required; a missing grant fails with
-- 42501 before any policy runs.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- A policy on group_members that reads group_members raises 42P17 infinite
-- recursion. A security definer function reads it as its owner and breaks the
-- cycle. Kept out of an exposed schema so it is not callable over the Data API.
create function private.user_group_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select group_id
  from public.group_members
  where user_id = (select auth.uid())
$$;

-- Creating a group is the one moment a user has no member row yet, so the
-- first group_members insert cannot be gated on membership.
create function private.owns_group(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.groups
    where id = target_group_id
      and created_by = (select auth.uid())
  )
$$;

create function private.transaction_group_id(target_transaction_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select group_id from public.transactions where id = target_transaction_id
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.user_group_ids() to authenticated;
grant execute on function private.owns_group(uuid) to authenticated;
grant execute on function private.transaction_group_id(uuid) to authenticated;

-- profiles ------------------------------------------------------------------

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

create policy "own profile is readable"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "own profile is insertable"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "own profile is updatable"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- groups --------------------------------------------------------------------
-- No delete policy anywhere: deletes are soft, or sync cannot propagate them.

alter table public.groups enable row level security;
revoke all on table public.groups from anon, authenticated;
grant select, insert, update on table public.groups to authenticated;

create policy "members read groups"
on public.groups for select to authenticated
using (id in (select private.user_group_ids()));

create policy "creator inserts group"
on public.groups for insert to authenticated
with check (created_by = (select auth.uid()));

create policy "members update groups"
on public.groups for update to authenticated
using (id in (select private.user_group_ids()))
with check (id in (select private.user_group_ids()));

-- group_members -------------------------------------------------------------

alter table public.group_members enable row level security;
revoke all on table public.group_members from anon, authenticated;
grant select, insert, update, delete on table public.group_members to authenticated;

create policy "members read group members"
on public.group_members for select to authenticated
using (group_id in (select private.user_group_ids()));

create policy "members insert group members"
on public.group_members for insert to authenticated
with check (
  group_id in (select private.user_group_ids())
  or private.owns_group(group_id)
);

create policy "members update group members"
on public.group_members for update to authenticated
using (group_id in (select private.user_group_ids()))
with check (group_id in (select private.user_group_ids()));

-- A member row has no deleted_at; it is only removable while unreferenced.
create policy "members delete group members"
on public.group_members for delete to authenticated
using (group_id in (select private.user_group_ids()));

-- transactions --------------------------------------------------------------

alter table public.transactions enable row level security;
revoke all on table public.transactions from anon, authenticated;
grant select, insert, update on table public.transactions to authenticated;

create policy "members read transactions"
on public.transactions for select to authenticated
using (group_id in (select private.user_group_ids()));

create policy "members insert transactions"
on public.transactions for insert to authenticated
with check (group_id in (select private.user_group_ids()));

create policy "members update transactions"
on public.transactions for update to authenticated
using (group_id in (select private.user_group_ids()))
with check (group_id in (select private.user_group_ids()));

-- transaction_shares --------------------------------------------------------
-- Shares are replaced wholesale when a bill is edited, so delete is allowed
-- here; the parent transaction's updated_at carries the change to other devices.

alter table public.transaction_shares enable row level security;
revoke all on table public.transaction_shares from anon, authenticated;
grant select, insert, update, delete on table public.transaction_shares to authenticated;

create policy "members read shares"
on public.transaction_shares for select to authenticated
using (private.transaction_group_id(transaction_id) in (select private.user_group_ids()));

create policy "members insert shares"
on public.transaction_shares for insert to authenticated
with check (private.transaction_group_id(transaction_id) in (select private.user_group_ids()));

create policy "members update shares"
on public.transaction_shares for update to authenticated
using (private.transaction_group_id(transaction_id) in (select private.user_group_ids()))
with check (private.transaction_group_id(transaction_id) in (select private.user_group_ids()));

create policy "members delete shares"
on public.transaction_shares for delete to authenticated
using (private.transaction_group_id(transaction_id) in (select private.user_group_ids()));

-- exchange_rates ------------------------------------------------------------
-- A shared, non-private cache: any signed-in user may read or refresh it.

alter table public.exchange_rates enable row level security;
revoke all on table public.exchange_rates from anon, authenticated;
grant select, insert, update on table public.exchange_rates to authenticated;

create policy "anyone signed in reads rates"
on public.exchange_rates for select to authenticated
using (true);

create policy "anyone signed in inserts rates"
on public.exchange_rates for insert to authenticated
with check (true);

create policy "anyone signed in refreshes rates"
on public.exchange_rates for update to authenticated
using (true)
with check (true);

-- group_invites -------------------------------------------------------------
-- An invitee is not a member yet, so they cannot read their own invite row.
-- Claiming therefore goes through a definer RPC instead of a select policy,
-- which also stops the table being enumerated by token.

alter table public.group_invites enable row level security;
revoke all on table public.group_invites from anon, authenticated;
grant select, insert, delete on table public.group_invites to authenticated;

create policy "members read invites"
on public.group_invites for select to authenticated
using (group_id in (select private.user_group_ids()));

create policy "members create invites"
on public.group_invites for insert to authenticated
with check (
  group_id in (select private.user_group_ids())
  and created_by = (select auth.uid())
);

create policy "members revoke invites"
on public.group_invites for delete to authenticated
using (group_id in (select private.user_group_ids()));

create function public.claim_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_group_id uuid;
  claimed_member_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select group_id, member_id into claimed_group_id, claimed_member_id
  from public.group_invites
  where token = invite_token and expires_at > now();

  if claimed_group_id is null then
    raise exception 'invite is invalid or expired' using errcode = '22023';
  end if;

  update public.group_members
  set user_id = (select auth.uid()), updated_at = now()
  where id = claimed_member_id and user_id is null;

  if not found then
    raise exception 'member is already claimed' using errcode = '23505';
  end if;

  delete from public.group_invites where token = invite_token;

  return claimed_group_id;
end;
$$;

revoke execute on function public.claim_invite(text) from public, anon;
grant execute on function public.claim_invite(text) to authenticated;
