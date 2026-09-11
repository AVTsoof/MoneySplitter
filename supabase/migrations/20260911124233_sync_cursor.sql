-- Makes updated_at safe to use as a sync cursor.
--
-- Two separate failures are being fixed here.
--
-- 1. Client clocks are not trustworthy. RxDB's replication guide states the
--    rule plainly: the backend must overwrite updated_at when it receives a
--    write. A device five minutes slow would otherwise stamp a row below a
--    cursor another device has already passed, and that row is never pulled.
--
-- 2. Even a server clock is not enough on its own, because a timestamp is
--    assigned before the transaction commits. A write stamped 10:00:00 that
--    commits at 10:00:05 is invisible to a puller that already advanced its
--    cursor to 10:00:02. The database cannot close this; the client closes it
--    by re-reading a short overlap window. See web/src/data/syncCursor.ts.
--
-- clock_timestamp() rather than now(): it is read at the moment of the write
-- instead of at transaction start, which both shrinks the window in (2) and
-- keeps updated_at strictly increasing for two writes inside one transaction.

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger set_updated_at
before insert or update on public.profiles
for each row execute function private.set_updated_at();

create trigger set_updated_at
before insert or update on public.groups
for each row execute function private.set_updated_at();

create trigger set_updated_at
before insert or update on public.group_members
for each row execute function private.set_updated_at();

create trigger set_updated_at
before insert or update on public.transactions
for each row execute function private.set_updated_at();

alter table public.groups alter column updated_at set default clock_timestamp();
alter table public.group_members alter column updated_at set default clock_timestamp();
alter table public.transactions alter column updated_at set default clock_timestamp();

-- Two rows can share a timestamp, so the cursor is the pair (updated_at, id)
-- and pages are ordered by both. Without the id the sort is non-deterministic
-- and keyset pagination can skip a row.
drop index public.groups_updated_at_idx;
create index groups_cursor_idx on public.groups (updated_at, id);

create index group_members_cursor_idx on public.group_members (group_id, updated_at, id);

drop index public.transactions_group_updated_idx;
create index transactions_cursor_idx on public.transactions (group_id, updated_at, id);
