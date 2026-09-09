# Authorization Model (Supabase RLS)

Replaces `firebase_auth_architecture.md`, which described a Firestore design that was
never implemented.

The client talks to Postgres directly with `@supabase/supabase-js`. There is no API
server, so **the database is the security boundary**. Every rule below is load-bearing.

## Why Postgres over Firestore

Firestore rules charge a document read for every `exists()` lookup, so checking group
membership on each row would burn the free tier's 50k daily reads quickly. In Postgres
the same check is one indexed SQL predicate, and it can be tested with a real test
harness (pgTAP) rather than an emulator.

## Data model

Members are rows, not names in an array:

```
group_members(id, group_id, display_name, user_id NULL, unique(group_id, display_name))
```

`user_id` is nullable on purpose. A guest who never signs up can still appear on a bill;
an invited user claims their existing row later by setting `user_id`. This also makes a
rename a single `UPDATE`, where the old CSV design had to rewrite every transaction.

## The membership rule

Everything is gated on "is the caller a member of this group".

Writing that check naively causes a cycle: a policy on `groups` reads `group_members`,
whose own policy reads `groups`. Postgres raises `42P17 infinite recursion detected in
policy`. Break it with a `security definer` function that reads the membership table as
its owner:

```sql
create schema if not exists private;

create function private.user_group_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select group_id from public.group_members where user_id = (select auth.uid())
$$;

revoke execute on function private.user_group_ids() from public;
grant usage on schema private to authenticated;
grant execute on function private.user_group_ids() to authenticated;
```

Then policies stay flat:

```sql
create policy "members read transactions"
on public.transactions for select
to authenticated
using ( group_id in (select private.user_group_ids()) );
```

## Rules to follow

**Grants are separate from policies, and both are required.** Since May 2026 new Supabase
projects no longer auto-expose `public` tables to the Data API, enforced on existing
projects from October 2026. Without a grant the client fails with `42501` before any
policy runs.

```sql
alter table public.transactions enable row level security;
revoke all on table public.transactions from anon, authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
```

**Wrap helpers in `(select ...)`.** This makes the planner evaluate them once per
statement instead of once per row. Supabase measured 11,000ms to 7ms on a join-backed
policy.

**Always name the role** with `to authenticated`, so anonymous requests stop before the
policy body executes.

**One policy per operation.** Postgres does not accept several operations in one `for`
clause, and `for all` hides which rule covers what. Note an `update` needs both `using`
and `with check`, plus a matching `select` policy or it silently affects nothing.

**Index every column a policy filters on**, and remember only the leading column of a
btree counts. A composite primary key on `(group_id, user_id)` does not index `user_id`.

**Keep definer functions out of exposed schemas.** Anything in `public` is callable over
the Data API with the creator's privileges. Always pin `search_path = ''` and
schema-qualify names inside, or a caller can point an unqualified name at their own
object.

**RLS is not a filter.** It decides what is *permitted*, not what is *returned*. Client
queries must still scope explicitly:

```ts
supabase.from('transactions').select('*').eq('group_id', groupId)
```

**Never hard-delete.** Set `deleted_at`. A removed row cannot be propagated to another
device during sync.

## Keys

The publishable (anon) key ships in the client bundle by design; RLS is what protects the
data, not secrecy of that key. The `service_role`/secret key bypasses RLS entirely and
must never reach the frontend or the repository.

## Testing

Policies are not correct until proven. Each table gets `supabase/tests/<table>_rls.test.sql`,
run with `supabase test db`.

Match the assertion to how the request is denied:

| Denied by | Postgres | Assert with |
| --- | --- | --- |
| Missing grant | raises `42501` | `throws_ok` |
| `with check` violation | raises `42501` | `throws_ok` |
| `using` filtering the row out | no error, zero rows | `is_empty` plus a read proving the row survived |

Never prove an allowed write with `lives_ok`; it passes when zero rows matched. Use
`returning` and assert the returned value.
