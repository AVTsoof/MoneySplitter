import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { calculateShares } from '../splitStrategies'
import type { SplitStrategy } from '../types'
import equalCases from './fixtures/equal-split.json'
import exactCases from './fixtures/exact-split.json'
import errorCases from './fixtures/split-errors.json'
import percentageCases from './fixtures/percentage-split.json'

type Amounts = Record<string, string>

// Fixture cases cover different member sets, so JSON infers optional keys per
// case. Widen once here rather than casting at every call site.
type SplitCase = {
  name: string
  total: string
  participants: string[]
  expected: Amounts
  amounts: Amounts
  percentages: Amounts
}
const equal = equalCases as unknown as SplitCase[]
const exact = exactCases as unknown as SplitCase[]
const percentage = percentageCases as unknown as SplitCase[]
const errors = errorCases as unknown as {
  name: string
  strategy: SplitStrategy
  total: string
  participants: string[]
}[]

// The Python oracle emits Decimal.__str__, which preserves the operand's scale
// ("0" vs "0.00"). Money is always 2dp here, so compare at 2dp on both sides.
const at2dp = (shares: Record<string, Decimal | string>) =>
  Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, new Decimal(v).toFixed(2)]))

describe('equal split', () => {
  it.each(equal)('$name', ({ total, participants, expected }) => {
    expect(at2dp(calculateShares({ type: 'equal' }, total, participants))).toEqual(at2dp(expected))
  })

  it.each(equal)('$name sums back to the total', ({ total, participants }) => {
    const shares = Object.values(calculateShares({ type: 'equal' }, total, participants))
    const sum = shares.reduce((a, b) => a.plus(b), new Decimal(0))
    expect(sum.toFixed(2)).toBe(new Decimal(total).toFixed(2))
  })

  it('returns nothing when there are no participants', () => {
    expect(calculateShares({ type: 'equal' }, '10.00', [])).toEqual({})
  })
})

describe('exact split', () => {
  it.each(exact)('$name', ({ total, participants, amounts, expected }) => {
    expect(at2dp(calculateShares({ type: 'exact', amounts }, total, participants))).toEqual(
      at2dp(expected),
    )
  })
})

describe('percentage split', () => {
  it.each(percentage)('$name', ({ total, participants, percentages, expected }) => {
    expect(
      at2dp(calculateShares({ type: 'percentage', percentages }, total, participants)),
    ).toEqual(at2dp(expected))
  })
})

describe('invalid splits', () => {
  it.each(errors)('$name', ({ strategy, total, participants }) => {
    expect(() => calculateShares(strategy, total, participants)).toThrow()
  })
})
