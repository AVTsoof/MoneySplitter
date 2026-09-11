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
  it('seeds the example trip once with its members and transactions', async () => {
    const firstGroupId = await repo.seedExampleGroup()
    const members = await repo.getMembers(firstGroupId)
    const transactions = await repo.getTransactions(firstGroupId)

    expect((await repo.getGroup(firstGroupId))?.name).toBe('Example Italy Trip')
    expect(members.map((member) => member.displayName)).toEqual([
      'Alice',
      'Ariel',
      'Bob',
      'Charlie',
      'David',
    ])
    expect(transactions).toHaveLength(34)
    expect(await repo.seedExampleGroup()).toBe(firstGroupId)
    expect(await repo.listGroups()).toHaveLength(1)
  })

  it('lists groups oldest first, whatever order their ids sort in', async () => {
    // The app opens groups[0], so an id-ordered list would change which group
    // the user lands on as soon as another group is added.
    const older = 'ffffffff-1111-4000-8000-000000000001'
    const newer = '11111111-1111-4000-8000-000000000002'
    await repo.createGroup({ id: older, name: 'Older', defaultCurrency: 'EUR', members: ['A'] })
    await repo.createGroup({ id: newer, name: 'Newer', defaultCurrency: 'EUR', members: ['B'] })
    await db.groups.update(older, { createdAt: '2026-01-01T00:00:00.000Z' })
    await db.groups.update(newer, { createdAt: '2026-02-01T00:00:00.000Z' })

    expect((await repo.listGroups()).map((group) => group.name)).toEqual(['Older', 'Newer'])
  })

  it('breaks a createdAt tie by id so the order is total', async () => {
    const first = '11111111-1111-4000-8000-000000000003'
    const second = 'ffffffff-1111-4000-8000-000000000004'
    await repo.createGroup({ id: second, name: 'Second', defaultCurrency: 'EUR', members: ['A'] })
    await repo.createGroup({ id: first, name: 'First', defaultCurrency: 'EUR', members: ['B'] })
    await db.groups.update(first, { createdAt: '2026-01-01T00:00:00.000Z' })
    await db.groups.update(second, { createdAt: '2026-01-01T00:00:00.000Z' })

    expect((await repo.listGroups()).map((group) => group.name)).toEqual(['First', 'Second'])
  })

  it('creates a group with its members', async () => {
    const ids = await seedGroup()
    const group = await repo.getGroup(groupId)
    expect(group?.name).toBe('Italy')
    expect(group?.activeCurrencies).toEqual(['EUR'])
    expect(Object.keys(ids).sort()).toEqual(['Alice', 'Bob'])
  })

  it('assigns unique member colors and rejects a color already in use', async () => {
    await seedGroup()
    const members = await repo.getMembers(groupId)

    expect(new Set(members.map((member) => member.color)).size).toBe(2)
    await expect(repo.setMemberColor(members[1].id, members[0].color)).rejects.toThrow(
      'That color is already in use.',
    )
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

  it('updates an expense and replaces its computed shares atomically', async () => {
    const ids = await seedGroup()
    const id = await repo.addExpense({
      groupId,
      payerMemberId: ids.Alice,
      participantMemberIds: [ids.Alice, ids.Bob],
      amount: '10.00',
      currency: 'EUR',
      description: 'Coffee',
      strategy: { type: 'equal' },
    })

    await repo.updateExpense(id, {
      groupId,
      payerMemberId: ids.Bob,
      participantMemberIds: [ids.Bob],
      amount: '12.00',
      currency: 'USD',
      description: 'Brunch',
      strategy: { type: 'equal' },
    })

    expect(await db.transactions.get(id)).toMatchObject({
      payerMemberId: ids.Bob,
      amount: '12.00',
      currency: 'USD',
      description: 'Brunch',
    })
    await expect(repo.getShares(id)).resolves.toEqual([
      expect.objectContaining({ memberId: ids.Bob, amount: '12.00' }),
    ])
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
