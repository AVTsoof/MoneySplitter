import type { SplitStrategy } from '../core/types'

/**
 * These types are the shape of the future Postgres rows, not a convenience
 * shape for IndexedDB. Every row carries a client-generated uuid so offline
 * inserts are idempotent when they later sync, plus updatedAt for last-write-
 * wins and deletedAt for soft deletes (a hard delete cannot be propagated).
 * Timestamps are ISO-8601 UTC strings; money is a decimal string, never a
 * number.
 */

export type Uuid = string
export type Timestamp = string

export type Group = {
  id: Uuid
  name: string
  defaultCurrency: string
  activeCurrencies: string[]
  createdBy: Uuid | null
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export type GroupMember = {
  id: Uuid
  groupId: Uuid
  displayName: string
  color: string
  /** Null until a signed-in user claims this member via an invite. */
  userId: Uuid | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type TransactionRow = {
  id: Uuid
  groupId: Uuid
  type: 'expense' | 'transfer'
  amount: string
  currency: string
  description: string
  occurredAt: Timestamp
  payerMemberId: Uuid | null
  senderMemberId: Uuid | null
  receiverMemberId: Uuid | null
  splitStrategy: SplitStrategy | null
  createdBy: Uuid | null
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export type TransactionShare = {
  transactionId: Uuid
  memberId: Uuid
  amount: string
}

export type ExchangeRateCache = {
  base: string
  rates: Record<string, string>
  fetchedAt: Timestamp
}

export type OutboxEntry = {
  id: number
  op: 'upsert' | 'delete'
  table: 'groups' | 'groupMembers' | 'transactions' | 'transactionShares'
  rowId: string
  payload: unknown
  createdAt: Timestamp
  attempts: number
}

export type SyncMeta = {
  table: string
  lastPulledAt: Timestamp | null
}
