import { Decimal } from './money'
import currencies from './data/currencies.json'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  ILS: '₪',
}

const metadata = currencies as Record<string, { name: string }>

/**
 * Rates are normalised against a single base (Frankfurter is queried with
 * base=USD), so any pair is the ratio of the two entries.
 */
export function getExchangeRate(
  rates: Record<string, string | number>,
  from: string,
  to: string,
): Decimal {
  if (from === to) return new Decimal(1)
  if (Object.keys(rates).length === 0) return new Decimal(1)

  const rateFrom = new Decimal(rates[from] ?? 1)
  const rateTo = new Decimal(rates[to] ?? 1)
  if (rateFrom.isZero()) return new Decimal(1)

  return rateTo.dividedBy(rateFrom)
}

export function getSupportedCurrencyCodes(): string[] {
  return Object.keys(metadata).sort()
}

export function getCurrencyName(code: string): string {
  return metadata[code]?.name ?? code
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code
}
