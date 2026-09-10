import { useState } from 'react'
import { getExchangeRate } from '../../core/currency'
import { getGroup } from '../../data/repository'
import { getExchangeRates } from '../../data/exchangeRates'
import type { Uuid } from '../../data/schema'
import './RatesTab.css'

type RatesTabProps = {
  groupId: Uuid
}

export function RatesTab({ groupId }: RatesTabProps) {
  const [base, setBase] = useState('')
  const [currencies, setCurrencies] = useState<string[]>([])
  const [rates, setRates] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function refresh() {
    setIsLoading(true)
    setError('')
    try {
      const group = await getGroup(groupId)
      if (!group) return
      setBase(group.defaultCurrency)
      setCurrencies(group.activeCurrencies)
      setRates(await getExchangeRates(group.defaultCurrency))
    } catch {
      setError('Rates are unavailable. Try again when you are online.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="rates-tab">
      <button type="button" onClick={refresh} disabled={isLoading}>
        {isLoading ? 'Refreshing rates...' : 'Refresh rates'}
      </button>
      {error && <p className="rates-error">{error}</p>}
      {rates && (
        <div className="rates-matrix-wrap">
          <table className="rates-matrix" aria-label="Currency conversion matrix">
            <thead>
              <tr>
                <th scope="col">From / To</th>
                {currencies.map((currency) => (
                  <th key={currency} scope="col">
                    {currency}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currencies.map((from) => (
                <tr key={from}>
                  <th scope="row">{from}</th>
                  {currencies.map((to) => (
                    <td key={to}>{getExchangeRate(rates, from, to).toFixed(6)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rates-base">Rates loaded with {base} as the reference currency.</p>
        </div>
      )}
    </div>
  )
}
