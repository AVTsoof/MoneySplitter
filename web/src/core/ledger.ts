import { Decimal, to2dp } from './money'
import { getExchangeRate } from './currency'
import { applyToBalances } from './transactions'
import type { Balances, MultiBalances, Transaction } from './types'

export function getNetBalances(transactions: Transaction[]): MultiBalances {
  const multi: MultiBalances = {}
  for (const tx of transactions) {
    multi[tx.currency] ??= {}
    applyToBalances(tx, multi[tx.currency])
  }
  return multi
}

/**
 * Converts every per-currency balance into `baseCurrency`. A currency with no
 * rate is skipped entirely rather than assumed 1:1, so a missing rate under-
 * reports instead of silently inventing money.
 */
export function getUnifiedBalances(
  transactions: Transaction[],
  baseCurrency: string,
  rates: Record<string, string | Decimal>,
): Balances {
  const unified: Balances = {}

  for (const [currency, balances] of Object.entries(getNetBalances(transactions))) {
    let rate = new Decimal(1)
    if (currency !== baseCurrency) {
      if (rates[currency] === undefined) continue
      rate = new Decimal(rates[currency])
    }

    for (const [member, balance] of Object.entries(balances)) {
      const converted = to2dp(balance.times(rate))
      unified[member] = (unified[member] ?? new Decimal(0)).plus(converted)
    }
  }

  return unified
}

/** Converts cached base rates into one reporting currency without network access. */
export function getBalancesInCurrency(
  multi: MultiBalances,
  targetCurrency: string,
  rates: Record<string, string | number>,
): Balances {
  const unified: Balances = {}

  for (const [currency, balances] of Object.entries(multi)) {
    if (currency !== targetCurrency && rates[currency] === undefined) continue
    const rate = getExchangeRate(rates, currency, targetCurrency)
    for (const [member, balance] of Object.entries(balances)) {
      const converted = to2dp(balance.times(rate))
      unified[member] = (unified[member] ?? new Decimal(0)).plus(converted)
    }
  }

  return unified
}
