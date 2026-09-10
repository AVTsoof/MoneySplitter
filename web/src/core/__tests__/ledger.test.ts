import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { getBalancesInCurrency, getNetBalances, getUnifiedBalances } from '../ledger'
import type { Transaction } from '../types'
import netBalanceCases from './fixtures/net-balances.json'
import unifiedCases from './fixtures/unified-balances.json'

type Balances = Record<string, string>

const net = netBalanceCases as unknown as {
  name: string
  transactions: Transaction[]
  expected: Record<string, Balances>
}[]

const unified = unifiedCases as unknown as {
  name: string
  transactions: Transaction[]
  baseCurrency: string
  rates: Record<string, string>
  expected: Balances
}[]

const at2dp = (b: Record<string, Decimal | string>) =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, new Decimal(v).toFixed(2)]))

const nested = (b: Record<string, Record<string, Decimal | string>>) =>
  Object.fromEntries(Object.entries(b).map(([cur, bal]) => [cur, at2dp(bal)]))

describe('net balances', () => {
  it.each(net)('$name', ({ transactions, expected }) => {
    expect(nested(getNetBalances(transactions))).toEqual(nested(expected))
  })

  it.each(net)('$name nets to zero per currency', ({ transactions }) => {
    for (const balances of Object.values(getNetBalances(transactions))) {
      const sum = Object.values(balances).reduce((a, b) => a.plus(b), new Decimal(0))
      expect(sum.toFixed(2)).toBe('0.00')
    }
  })

  it('is unaffected by transaction ordering', () => {
    const { transactions } = net.find((c) => c.name === 'multi currency ledger')!
    const forward = nested(getNetBalances(transactions))
    const reversed = nested(getNetBalances([...transactions].reverse()))
    expect(reversed).toEqual(forward)
  })
})

describe('unified balances', () => {
  it.each(unified)('$name', ({ transactions, baseCurrency, rates, expected }) => {
    expect(at2dp(getUnifiedBalances(transactions, baseCurrency, rates))).toEqual(at2dp(expected))
  })
})

describe('reporting currency balances', () => {
  it('converts cached base rates into the requested currency', () => {
    expect(
      at2dp(
        getBalancesInCurrency({ USD: { Alice: new Decimal('5'), Bob: new Decimal('-5') } }, 'EUR', {
          USD: '1.08',
        }),
      ),
    ).toEqual({ Alice: '4.63', Bob: '-4.63' })
  })
})
