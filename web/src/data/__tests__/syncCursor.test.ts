import { describe, expect, it } from 'vitest'
import { PULL_OVERLAP_MS, advanceCursor, pullLowerBound } from '../syncCursor'

describe('pullLowerBound', () => {
  it('starts at the epoch on the very first pull', () => {
    expect(pullLowerBound(null)).toBe('1970-01-01T00:00:00.000Z')
  })

  it('re-reads an overlap window behind the cursor', () => {
    // A write stamped 10:00:00 can still commit after a puller has moved past
    // it, so the next pull must reach back before its own cursor.
    expect(pullLowerBound('2026-09-11T10:00:30.000Z')).toBe('2026-09-11T10:00:00.000Z')
  })

  it('uses a window wider than the statement timeout that bounds a write', () => {
    expect(PULL_OVERLAP_MS).toBeGreaterThan(8_000)
  })
})

describe('advanceCursor', () => {
  it('keeps the old cursor when nothing came back', () => {
    expect(advanceCursor('2026-09-11T10:00:00.000Z', [])).toBe('2026-09-11T10:00:00.000Z')
  })

  it('moves to the newest row received', () => {
    const rows = [
      { updatedAt: '2026-09-11T10:00:01.000Z' },
      { updatedAt: '2026-09-11T10:00:09.000Z' },
      { updatedAt: '2026-09-11T10:00:05.000Z' },
    ]
    expect(advanceCursor('2026-09-11T10:00:00.000Z', rows)).toBe('2026-09-11T10:00:09.000Z')
  })

  it('never moves backwards, since the overlap re-reads older rows', () => {
    const rows = [{ updatedAt: '2026-09-11T09:59:00.000Z' }]
    expect(advanceCursor('2026-09-11T10:00:00.000Z', rows)).toBe('2026-09-11T10:00:00.000Z')
  })

  it('accepts a null cursor', () => {
    const rows = [{ updatedAt: '2026-09-11T10:00:01.000Z' }]
    expect(advanceCursor(null, rows)).toBe('2026-09-11T10:00:01.000Z')
  })

  it('compares Postgres timestamps against the stored cursor as instants', () => {
    // Postgres sends "+00:00" where toISOString() writes "Z". Sorted as plain
    // strings the newer row below looks older, and the cursor would stall.
    const rows = [{ updatedAt: '2026-09-11T10:00:05.123456+00:00' }]
    expect(advanceCursor('2026-09-11T10:00:05.000Z', rows)).toBe('2026-09-11T10:00:05.123Z')
  })
})
