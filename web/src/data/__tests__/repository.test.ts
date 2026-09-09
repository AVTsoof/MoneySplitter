import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from '../db'
import * as repo from '../repository'

const groupId = '11111111-1111-4000-8000-000000000001'

async function seedGroup() {
  await repo.createGroup({
    id: groupId,
    name: 'Italy',
    defaultCurrency: 'EUR',
    members: ['Alice', 'Bob'],
  })
  const members = await repo.getMembers(groupId)
  return Object.fromEntries(members.map((m) => [m.displayName, m.id]))
}

beforeEach(async () => {
  await resetDatabase()
})

describe('groups', () => {
  it('creates a group with its members', async () => {
    const ids = await seedGroup()
    const group = await repo.getGroup(groupId)
    expect(group?.name).toBe('Italy')
    expect(group?.activeCurrencies).toEqual(['EUR'])
    expect(Object.keys(ids).sort()).toEqual(['Alice', 'Bob'])
  })

  it('lists only groups that are not deleted', async () => {
    await seedGroup()
    expect((await repo.listGroups()).map((g) => g.id)).toEqual([groupId])
    await repo.deleteGroup(groupId)
    expect(await repo.listGroups()).toEqual([])
  })

  it('renames a member without touching its transactions', async () => {
    const ids = await seedGroup()
    await repo.addExpense({
      groupId,
      payerMemberId: ids.Alice,
      participantMemberIds: [ids.Alice, ids.Bob],
      amount: '10.00',
      currency: 'EUR',
      description: 'Coffee',
      strategy: { type: 'equal' },
    })
    await repo.renameMember(ids.Alice, 'Alicia')
    const members = await repo.getMembers(groupId)
    expect(members.find((m) => m.id === ids.Alice)?.displayName).toBe('Alicia')
    const txs = await repo.getTransactions(groupId)
    expect(txs[0].payerMemberId).toBe(ids.Alice)
  })
})

describe('transactions', () => {
  it('stores an expense with its computed shares', async () => {
    const ids = await seedGroup()
    const id = await repo.addExpense({
      groupId,
      payerMemberId: ids.Alice,
      participantMemberIds: [ids.Alice, ids.Bob],
      amount: '10.01',
      currency: 'EUR',
      description: 'Coffee',
      strategy: { type: 'equal' },
    })

    const shares = await repo.getShares(id)
    expect(shares.map((s) => s.amount).sort()).toEqual(['5.00', '5.01'])
  })

  it('sets updatedAt and leaves deletedAt null on insert', async () => {
    const ids = await seedGroup()
    const id = await repo.addTransfer({
      groupId,
      senderMemberId: ids.Alice,
      receiverMemberId: ids.Bob,
      amount: '5.00',
      currency: 'EUR',
      description: 'Payback',
    })

    const row = await db.transactions.get(id)
    expect(row?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(row?.deletedAt).toBeNull()
  })

  it('soft deletes so the removal can propagate to other devices', async () => {
    const ids = await seedGroup()
    const id = await repo.addTransfer({
      groupId,
      senderMemberId: ids.Alice,
      receiverMemberId: ids.Bob,
      amount: '5.00',
      currency: 'EUR',
      description: 'Payback',
    })

    await repo.deleteTransaction(id)

    expect(await repo.getTransactions(groupId)).toEqual([])
    const row = await db.transactions.get(id)
    expect(row).toBeDefined()
    expect(row?.deletedAt).not.toBeNull()
  })

  it('bumps updatedAt when a transaction changes', async () => {
    const ids = await seedGroup()
    const id = await repo.addTransfer({
      groupId,
      senderMemberId: ids.Alice,
      receiverMemberId: ids.Bob,
      amount: '5.00',
      currency: 'EUR',
      description: 'Payback',
    })
    const before = (await db.transactions.get(id))!.updatedAt

    await new Promise((r) => setTimeout(r, 2))
    await repo.updateTransaction(id, { description: 'Hotel deposit' })

    const after = await db.transactions.get(id)
    expect(after?.description).toBe('Hotel deposit')
    // Strictly greater: sync resolves conflicts by updatedAt, so an edit that
    // leaves the timestamp untouched would silently lose to a stale remote row.
    expect(after!.updatedAt > before).toBe(true)
  })

  it('reports whether a member has any transactions', async () => {
    const ids = await seedGroup()
    expect(await repo.memberHasTransactions(ids.Alice)).toBe(false)
    await repo.addExpense({
      groupId,
      payerMemberId: ids.Alice,
      participantMemberIds: [ids.Alice, ids.Bob],
      amount: '10.00',
      currency: 'EUR',
      description: 'Coffee',
      strategy: { type: 'equal' },
    })
    expect(await repo.memberHasTransactions(ids.Alice)).toBe(true)
    expect(await repo.memberHasTransactions('nobody')).toBe(false)
  })
})
