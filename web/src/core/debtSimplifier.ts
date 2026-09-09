import Decimal from 'decimal.js'
import type { Balances, MultiBalances } from './types'

export type Settlement = { from: string; to: string; amount: string }

/** Balances closer to zero than this are treated as settled dust. */
const THRESHOLD = 0.001

type Entry = { value: number; member: string }

/**
 * Removes and returns the largest entry. Python pushes `(-value, member)` onto a
 * heap, so ties fall back to the member name ascending by code point; plain
 * comparison (not localeCompare) is what reproduces that for non-ASCII names.
 */
function takeLargest(entries: Entry[]): Entry {
  entries.sort(
    (a, b) => b.value - a.value || (a.member < b.member ? -1 : a.member > b.member ? 1 : 0),
  )
  return entries.shift()!
}

function simplifyOne(balances: Balances): Settlement[] {
  const debtors: Entry[] = []
  const creditors: Entry[] = []

  for (const [member, balance] of Object.entries(balances)) {
    const value = balance.toNumber()
    if (value < -THRESHOLD) debtors.push({ value: Math.abs(value), member })
    else if (value > THRESHOLD) creditors.push({ value, member })
  }

  const settlements: Settlement[] = []

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = takeLargest(debtors)
    const creditor = takeLargest(creditors)
    const amount = Math.min(debtor.value, creditor.value)
    const rounded = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

    if (rounded.greaterThan(0)) {
      settlements.push({ from: debtor.member, to: creditor.member, amount: rounded.toFixed(2) })
    }

    const remainingDebt = debtor.value - amount
    const remainingCredit = creditor.value - amount
    if (remainingDebt > THRESHOLD) debtors.push({ value: remainingDebt, member: debtor.member })
    if (remainingCredit > THRESHOLD) {
      creditors.push({ value: remainingCredit, member: creditor.member })
    }
  }

  return settlements
}

/** Greedily matches the largest debtor to the largest creditor, per currency. */
export function simplifyDebts(multi: MultiBalances): Record<string, Settlement[]> {
  return Object.fromEntries(
    Object.entries(multi).map(([currency, balances]) => [currency, simplifyOne(balances)]),
  )
}
