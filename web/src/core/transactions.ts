import Decimal from 'decimal.js'
import { calculateShares } from './splitStrategies'
import type { Balances, Shares, Transaction } from './types'

export function sharesOf(tx: Extract<Transaction, { kind: 'expense' }>): Shares {
  return calculateShares(tx.strategy, tx.amount, tx.participants)
}

const add = (balances: Balances, member: string, delta: Decimal) => {
  balances[member] = (balances[member] ?? new Decimal(0)).plus(delta)
}

/** Positive balance means the member is owed money. */
export function applyToBalances(tx: Transaction, balances: Balances): void {
  const amount = new Decimal(tx.amount)

  if (tx.kind === 'transfer') {
    add(balances, tx.sender, amount)
    add(balances, tx.receiver, amount.negated())
    return
  }

  add(balances, tx.payer, amount)
  for (const [member, share] of Object.entries(sharesOf(tx))) {
    add(balances, member, share.negated())
  }
}
