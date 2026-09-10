import { db } from './db'

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000

type FrankfurterResponse = {
  rates: Record<string, number>
}

export async function getCachedExchangeRates(base: string): Promise<Record<string, string>> {
  return (await db.exchangeRates.get(base))?.rates ?? {}
}

export async function getExchangeRates(base: string): Promise<Record<string, string>> {
  const cached = await db.exchangeRates.get(base)
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_DURATION_MS) {
    return cached.rates
  }

  const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`)
  if (!response.ok) throw new Error('Unable to load exchange rates.')

  const payload = (await response.json()) as FrankfurterResponse
  const rates = Object.fromEntries(
    Object.entries(payload.rates).map(([currency, rate]) => [currency, String(rate)]),
  )
  await db.exchangeRates.put({ base, rates, fetchedAt: new Date().toISOString() })
  return rates
}
