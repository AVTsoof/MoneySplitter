import type Decimal from 'decimal.js'

export type SplitStrategy =
  | { type: 'equal' }
  | { type: 'exact'; amounts: Record<string, string> }
  | { type: 'percentage'; percentages: Record<string, string> }

export type TransactionType = 'expense' | 'transfer'

/** Per-member share of a single expense, keyed by member name. */
export type Shares = Record<string, Decimal>

export type Expense = {
  kind: 'expense'
  id: string
  payer: string
  amount: string
  currency: string
  participants: string[]
  strategy: SplitStrategy
  description?: string
}

export type Transfer = {
  kind: 'transfer'
  id: string
  sender: string
  receiver: string
  amount: string
  currency: string
  description?: string
}

export type Transaction = Expense | Transfer

/** Balances keyed by member. Positive means the member is owed money. */
export type Balances = Record<string, Decimal>

/** Balances split per currency, since each currency settles independently. */
export type MultiBalances = Record<string, Balances>
