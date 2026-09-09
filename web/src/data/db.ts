import Dexie, { type EntityTable } from 'dexie'
import type {
  ExchangeRateCache,
  Group,
  GroupMember,
  OutboxEntry,
  SyncMeta,
  TransactionRow,
  TransactionShare,
} from './schema'

export class MoneySplitterDb extends Dexie {
  groups!: EntityTable<Group, 'id'>
  groupMembers!: EntityTable<GroupMember, 'id'>
  transactions!: EntityTable<TransactionRow, 'id'>
  transactionShares!: EntityTable<TransactionShare, 'transactionId'>
  exchangeRates!: EntityTable<ExchangeRateCache, 'base'>
  outbox!: EntityTable<OutboxEntry, 'id'>
  syncMeta!: EntityTable<SyncMeta, 'table'>

  constructor(name = 'moneysplitter') {
    super(name)
    // outbox and syncMeta are declared now although sync arrives in Stage B, so
    // adding the network layer needs no schema version bump.
    this.version(1).stores({
      groups: 'id, updatedAt, deletedAt',
      groupMembers: 'id, groupId, userId, &[groupId+displayName]',
      transactions: 'id, groupId, [groupId+occurredAt], [groupId+updatedAt], deletedAt',
      transactionShares: '[transactionId+memberId], transactionId, memberId',
      exchangeRates: 'base',
      outbox: '++id, createdAt',
      syncMeta: 'table',
    })
  }
}

export const db = new MoneySplitterDb()

/** Clears every table. Used by tests and the dev "reset demo data" action. */
export async function resetDatabase(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()))
}
