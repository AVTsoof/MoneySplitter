import Decimal from 'decimal.js'
import type { Shares, SplitStrategy } from './types'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

const CENT = new Decimal('0.01')

const to2dp = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

function equalShares(total: Decimal, participants: string[]): Shares {
  const base = to2dp(total.dividedBy(participants.length))
  const shares: Shares = Object.fromEntries(participants.map((p) => [p, base]))

  // Rounding leaves a residue of whole cents; hand them out one at a time from
  // the first participant. Truncates toward zero, matching Python's int().
  const residue = total.minus(base.times(participants.length))
  const pennies = residue.times(100).toNumber()
  const step = pennies > 0 ? 1 : -1

  for (let i = 0; i < Math.abs(Math.trunc(pennies)); i++) {
    const p = participants[i % participants.length]
    shares[p] = shares[p].plus(CENT.times(step))
  }

  return shares
}

function exactShares(
  total: Decimal,
  participants: string[],
  amounts: Record<string, string>,
): Shares {
  const sum = Object.values(amounts).reduce((a, v) => a.plus(new Decimal(v)), new Decimal(0))
  if (!sum.equals(total)) {
    throw new Error(`Sum of individual amounts (${sum}) must equal total amount (${total})`)
  }
  return Object.fromEntries(participants.map((p) => [p, new Decimal(amounts[p] ?? 0)]))
}

function percentageShares(
  total: Decimal,
  participants: string[],
  percentages: Record<string, string>,
): Shares {
  const sum = Object.values(percentages).reduce((a, v) => a.plus(new Decimal(v)), new Decimal(0))
  if (!sum.equals(100)) throw new Error('Percentages must sum to 100')

  const shares: Shares = Object.fromEntries(
    participants.map((p) => [
      p,
      to2dp(total.times(new Decimal(percentages[p] ?? 0)).dividedBy(100)),
    ]),
  )

  const allocated = Object.values(shares).reduce((a, v) => a.plus(v), new Decimal(0))
  const pennies = total.minus(allocated).times(100).toNumber()
  const step = pennies > 0 ? 1 : -1

  for (let i = 0; i < Math.abs(Math.trunc(pennies)); i++) {
    const p = participants[i % participants.length]
    shares[p] = shares[p].plus(CENT.times(step))
  }

  return shares
}

export function calculateShares(
  strategy: SplitStrategy,
  total: Decimal | string,
  participants: string[],
): Shares {
  const amount = new Decimal(total)

  if (strategy.type === 'exact') return exactShares(amount, participants, strategy.amounts)
  if (participants.length === 0) return {}
  if (strategy.type === 'percentage') {
    return percentageShares(amount, participants, strategy.percentages)
  }
  return equalShares(amount, participants)
}
