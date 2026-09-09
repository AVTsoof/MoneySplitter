import type Decimal from 'decimal.js'

export type SplitStrategy =
  | { type: 'equal' }
  | { type: 'exact'; amounts: Record<string, string> }
  | { type: 'percentage'; percentages: Record<string, string> }

export type TransactionType = 'expense' | 'transfer'

/** Per-member share of a single expense, keyed by member name. */
export type Shares = Record<string, Decimal>
