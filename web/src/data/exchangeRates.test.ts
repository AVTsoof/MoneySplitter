import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, resetDatabase } from './db'
import { getExchangeRates } from './exchangeRates'

describe('getExchangeRates', () => {
  beforeEach(async () => {
    await resetDatabase()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches and caches fresh rates from Frankfurter', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ base: 'EUR', rates: { USD: 1.08 } }), { status: 200 }),
    )

    await expect(getExchangeRates('EUR')).resolves.toEqual({ USD: '1.08' })
    expect(fetch).toHaveBeenCalledWith('https://api.frankfurter.dev/v1/latest?base=EUR')
    await expect(db.exchangeRates.get('EUR')).resolves.toMatchObject({ rates: { USD: '1.08' } })
  })

  it('uses a cache entry that is less than 24 hours old', async () => {
    await db.exchangeRates.add({
      base: 'EUR',
      rates: { USD: '1.08' },
      fetchedAt: new Date().toISOString(),
    })

    await expect(getExchangeRates('EUR')).resolves.toEqual({ USD: '1.08' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
