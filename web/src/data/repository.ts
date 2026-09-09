import { calculateShares } from '../core/splitStrategies'
import type { SplitStrategy } from '../core/types'
import { db } from './db'
import type { Group, GroupMember, TransactionRow, TransactionShare, Uuid } from './schema'

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

export type NewGroup = {
  id?: Uuid
  name: string
  defaultCurrency: string
  members: string[]
}

export async function createGroup({
  id = newId(),
  name,
  defaultCurrency,
  members,
}: NewGroup): Promise<Uuid> {
  const timestamp = now()
  await db.transaction('rw', db.groups, db.groupMembers, async () => {
    await db.groups.add({
      id,
      name,
      defaultCurrency,
      activeCurrencies: [defaultCurrency],
      createdBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    })
    await db.groupMembers.bulkAdd(
      members.map((displayName) => ({
        id: newId(),
        groupId: id,
        displayName,
        userId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    )
  })
  return id
}

export const getGroup = (groupId: Uuid) => db.groups.get(groupId)

export const listGroups = () => db.groups.filter((g) => g.deletedAt === null).toArray()

export async function updateGroup(groupId: Uuid, changes: Partial<Group>): Promise<void> {
  await db.groups.update(groupId, { ...changes, updatedAt: now() })
}

/** Soft delete, so the removal can reach other devices during sync. */
export async function deleteGroup(groupId: Uuid): Promise<void> {
  await db.groups.update(groupId, { deletedAt: now(), updatedAt: now() })
}

export const getMembers = (groupId: Uuid) =>
  db.groupMembers.where('groupId').equals(groupId).sortBy('displayName')

export async function addMember(groupId: Uuid, displayName: string): Promise<Uuid> {
  const id = newId()
  const timestamp = now()
  await db.groupMembers.add({
    id,
    groupId,
    displayName,
    userId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

/** Transactions reference members by id, so a rename is a single row update. */
export async function renameMember(memberId: Uuid, displayName: string): Promise<void> {
  await db.groupMembers.update(memberId, { displayName, updatedAt: now() })
}

export async function removeMember(memberId: Uuid): Promise<void> {
  await db.groupMembers.delete(memberId)
}

export async function memberHasTransactions(memberId: Uuid): Promise<boolean> {
  const involved = await db.transactions
    .filter(
      (t) =>
        t.deletedAt === null &&
        (t.payerMemberId === memberId ||
          t.senderMemberId === memberId ||
          t.receiverMemberId === memberId),
    )
    .count()
  if (involved > 0) return true
  return (await db.transactionShares.where('memberId').equals(memberId).count()) > 0
}

export const getTransactions = (groupId: Uuid) =>
  db.transactions
    .where('groupId')
    .equals(groupId)
    .filter((t) => t.deletedAt === null)
    .sortBy('occurredAt')

export const getShares = (transactionId: Uuid) =>
  db.transactionShares.where('transactionId').equals(transactionId).toArray()

export type NewExpense = {
  groupId: Uuid
  payerMemberId: Uuid
  participantMemberIds: Uuid[]
  amount: string
  currency: string
  description: string
  strategy: SplitStrategy
  occurredAt?: string
}

export async function addExpense(expense: NewExpense): Promise<Uuid> {
  const id = newId()
  const timestamp = now()
  const shares = calculateShares(expense.strategy, expense.amount, expense.participantMemberIds)

  const row: TransactionRow = {
    id,
    groupId: expense.groupId,
    type: 'expense',
    amount: expense.amount,
    currency: expense.currency,
    description: expense.description,
    occurredAt: expense.occurredAt ?? timestamp,
    payerMemberId: expense.payerMemberId,
    senderMemberId: null,
    receiverMemberId: null,
    splitStrategy: expense.strategy,
    createdBy: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }

  const shareRows: TransactionShare[] = Object.entries(shares).map(([memberId, amount]) => ({
    transactionId: id,
    memberId,
    amount: amount.toFixed(2),
  }))

  await db.transaction('rw', db.transactions, db.transactionShares, async () => {
    await db.transactions.add(row)
    await db.transactionShares.bulkAdd(shareRows)
  })

  return id
}

export type NewTransfer = {
  groupId: Uuid
  senderMemberId: Uuid
  receiverMemberId: Uuid
  amount: string
  currency: string
  description: string
  occurredAt?: string
}

export async function addTransfer(transfer: NewTransfer): Promise<Uuid> {
  const id = newId()
  const timestamp = now()
  await db.transactions.add({
    id,
    groupId: transfer.groupId,
    type: 'transfer',
    amount: transfer.amount,
    currency: transfer.currency,
    description: transfer.description,
    occurredAt: transfer.occurredAt ?? timestamp,
    payerMemberId: null,
    senderMemberId: transfer.senderMemberId,
    receiverMemberId: transfer.receiverMemberId,
    splitStrategy: null,
    createdBy: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  return id
}

export async function updateTransaction(id: Uuid, changes: Partial<TransactionRow>): Promise<void> {
  await db.transactions.update(id, { ...changes, updatedAt: now() })
}

/** Soft delete, so the removal can reach other devices during sync. */
export async function deleteTransaction(id: Uuid): Promise<void> {
  const timestamp = now()
  await db.transactions.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

export type { Group, GroupMember, TransactionRow, TransactionShare }
