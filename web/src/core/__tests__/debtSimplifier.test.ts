import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { simplifyDebts } from '../debtSimplifier'
import type { MultiBalances } from '../types'
import cases from './fixtures/debt-simplification.json'

type Settlement = { from: string; to: string; amount: string }

const simplifyCases = cases as unknown as {
  name: string
  balances: Record<string, Record<string, string>>
  expected: Record<string, Settlement[]>
}[]

const toMulti = (b: Record<string, Record<string, string>>): MultiBalances =>
  Object.fromEntries(
    Object.entries(b).map(([cur, bal]) => [
      cur,
      Object.fromEntries(Object.entries(bal).map(([m, v]) => [m, new Decimal(v)])),
    ]),
  )

describe('debt simplification', () => {
  it.each(simplifyCases)('$name', ({ balances, expected }) => {
    expect(simplifyDebts(toMulti(balances))).toEqual(expected)
  })

  it.each(simplifyCases)('$name settles every debtor', ({ balances }) => {
    const result = simplifyDebts(toMulti(balances))
    for (const [currency, bal] of Object.entries(balances)) {
      const moved: Record<string, Decimal> = {}
      // Paying moves a debtor's negative balance up toward zero, and draws the
      // creditor's positive balance down.
      for (const s of result[currency]) {
        moved[s.from] = (moved[s.from] ?? new Decimal(0)).plus(s.amount)
        moved[s.to] = (moved[s.to] ?? new Decimal(0)).minus(s.amount)
      }
      for (const [member, start] of Object.entries(bal)) {
        const settled = new Decimal(start).plus(moved[member] ?? 0)
        expect(settled.abs().lessThan('0.01')).toBe(true)
      }
    }
  })

  it('needs at most n-1 transfers for n members', () => {
    const { balances } = simplifyCases.find((c) => c.name === 'two creditors two debtors')!
    const members = Object.keys(balances.USD).length
    expect(simplifyDebts(toMulti(balances)).USD.length).toBeLessThanOrEqual(members - 1)
  })
})
