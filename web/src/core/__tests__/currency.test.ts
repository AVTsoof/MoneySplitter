import { describe, expect, it } from 'vitest'
import {
  getCurrencyName,
  getCurrencySymbol,
  getExchangeRate,
  getSupportedCurrencyCodes,
} from '../currency'
import cases from './fixtures/exchange-rates.json'

const rateCases = cases as unknown as {
  name: string
  rates: Record<string, string>
  from: string
  to: string
  expected: string
}[]

describe('exchange rate', () => {
  // Compare by value: Python renders Decimal('1.0') as "1.0" and decimal.js as
  // "1", which is a formatting artifact rather than a difference in the rate.
  it.each(rateCases)('$name', ({ rates, from, to, expected }) => {
    expect(getExchangeRate(rates, from, to).equals(expected)).toBe(true)
  })

  it('falls back to 1 when the source rate is zero', () => {
    expect(getExchangeRate({ USD: '0', EUR: '0.92' }, 'USD', 'EUR').equals(1)).toBe(true)
  })

  it('keeps full precision on a non-terminating ratio', () => {
    expect(getExchangeRate({ EUR: '0.92', GBP: '0.78' }, 'EUR', 'GBP').toString()).toBe(
      '0.8478260869565217391304347826',
    )
  })
})

describe('currency registry', () => {
  it('exposes sorted currency codes', () => {
    const codes = getSupportedCurrencyCodes()
    expect(codes).toContain('USD')
    expect(codes).toContain('EUR')
    expect([...codes]).toEqual([...codes].sort())
  })

  it('resolves a full currency name', () => {
    expect(getCurrencyName('USD')).toBe('United States Dollar')
  })

  it('falls back to the code when the currency is unknown', () => {
    expect(getCurrencyName('ZZZ')).toBe('ZZZ')
  })

  it('returns symbols for the common currencies', () => {
    expect(getCurrencySymbol('USD')).toBe('$')
    expect(getCurrencySymbol('EUR')).toBe('€')
    expect(getCurrencySymbol('ILS')).toBe('₪')
  })

  it('falls back to the code when there is no symbol', () => {
    expect(getCurrencySymbol('SEK')).toBe('SEK')
  })
})
