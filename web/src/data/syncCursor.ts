import type { Timestamp } from './schema'

/**
 * How far behind its own cursor a pull must re-read.
 *
 * A row's updated_at is stamped before its transaction commits, so a write
 * stamped 10:00:00 can become visible after a puller has already advanced past
 * 10:00:00 and would be missed forever. Re-reading a window wider than the
 * longest possible write closes that gap; Supabase caps a statement at 8s for
 * the authenticated role, so 30s is comfortably beyond it.
 *
 * Re-read rows are harmless: the pull upserts by primary key, and a row whose
 * updated_at is unchanged overwrites itself with identical values.
 */
export const PULL_OVERLAP_MS = 30_000

const EPOCH = new Date(0).toISOString()

/** The `updated_at >= ?` bound for the next pull. */
export function pullLowerBound(lastPulledAt: Timestamp | null): Timestamp {
  if (!lastPulledAt) return EPOCH
  return new Date(Date.parse(lastPulledAt) - PULL_OVERLAP_MS).toISOString()
}

/** The new cursor after a pull. Monotonic, because the overlap returns old rows. */
export function advanceCursor(
  lastPulledAt: Timestamp | null,
  rows: readonly { updatedAt: Timestamp }[],
): Timestamp | null {
  if (rows.length === 0) return lastPulledAt

  // Compared as instants, not as strings: Postgres sends "+00:00" where
  // toISOString() writes "Z", and those do not sort against each other.
  const newest = rows.reduce((max, row) => Math.max(max, Date.parse(row.updatedAt)), 0)
  const previous = lastPulledAt ? Date.parse(lastPulledAt) : 0

  // Postgres keeps microseconds and a JS Date only milliseconds, so this
  // truncates. It truncates downwards, which re-reads a row rather than
  // skipping one.
  return new Date(Math.max(newest, previous)).toISOString()
}
