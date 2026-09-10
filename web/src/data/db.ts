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
import { MEMBER_COLORS } from './memberColors'

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
    this.version(2)
      .stores({
        groups: 'id, updatedAt, deletedAt',
        groupMembers: 'id, groupId, userId, &[groupId+displayName]',
        transactions: 'id, groupId, [groupId+occurredAt], [groupId+updatedAt], deletedAt',
        transactionShares: '[transactionId+memberId], transactionId, memberId',
        exchangeRates: 'base',
        outbox: '++id, createdAt',
        syncMeta: 'table',
      })
      .upgrade(async (transaction) => {
        const members = (await transaction.table('groupMembers').toArray()) as GroupMember[]
        const usedByGroup = new Map<string, Set<string>>()
        for (const member of members) {
          const used = usedByGroup.get(member.groupId) ?? new Set<string>()
          member.color ??= MEMBER_COLORS.find((color) => !used.has(color)) ?? MEMBER_COLORS[0]
          used.add(member.color)
          usedByGroup.set(member.groupId, used)
        }
        await transaction.table('groupMembers').bulkPut(members)
      })
  }
}

export const db = new MoneySplitterDb()

/** Clears every table. Used by tests and the dev "reset demo data" action. */
export async function resetDatabase(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()))
}
