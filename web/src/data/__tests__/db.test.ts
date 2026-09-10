import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from '../db'

beforeEach(async () => {
  await resetDatabase()
})

describe('database schema', () => {
  it('exposes every table the Postgres schema will have', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'exchangeRates',
      'groupMembers',
      'groups',
      'outbox',
      'syncMeta',
      'transactionShares',
      'transactions',
    ])
  })

  it('indexes transactions by group so a group loads without a full scan', () => {
    expect(db.transactions.schema.indexes.map((i) => i.name)).toContain('groupId')
  })

  it('indexes transactions by updated_at for delta sync', () => {
    const names = db.transactions.schema.indexes.map((i) => i.name)
    expect(names).toContain('[groupId+updatedAt]')
  })

  it('round-trips a transaction row with its postgres-shaped fields', async () => {
    await db.transactions.add({
      id: 'a1b2c3d4-0001-4000-8000-000000000001',
      groupId: 'g1',
      type: 'expense',
      amount: '70.00',
      currency: 'EUR',
      description: 'Leonardo Express',
      occurredAt: '2025-07-05T10:30:00.000Z',
      payerMemberId: 'm1',
      senderMemberId: null,
      receiverMemberId: null,
      splitStrategy: { type: 'equal' },
      createdBy: null,
      createdAt: '2025-07-05T10:30:00.000Z',
      updatedAt: '2025-07-05T10:30:00.000Z',
      deletedAt: null,
    })

    const row = await db.transactions.get('a1b2c3d4-0001-4000-8000-000000000001')
    expect(row?.amount).toBe('70.00')
    expect(row?.splitStrategy).toEqual({ type: 'equal' })
    expect(row?.deletedAt).toBeNull()
  })

  it('enforces unique member display names within a group', async () => {
    const member = { groupId: 'g1', displayName: 'Alice', color: '#2563eb', userId: null }
    await db.groupMembers.add({ ...member, id: 'm1', createdAt: 'x', updatedAt: 'x' })
    await expect(
      db.groupMembers.add({ ...member, id: 'm2', createdAt: 'x', updatedAt: 'x' }),
    ).rejects.toThrow()
  })
})
