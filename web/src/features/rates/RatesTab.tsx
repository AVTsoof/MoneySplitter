import { useState } from 'react'
import { getGroup } from '../../data/repository'
import { getExchangeRates } from '../../data/exchangeRates'
import type { Uuid } from '../../data/schema'
import './RatesTab.css'

type RatesTabProps = {
  groupId: Uuid
}

export function RatesTab({ groupId }: RatesTabProps) {
  const [base, setBase] = useState('')
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
        <ul className="rates-list">
          {Object.entries(rates)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([currency, rate]) => (
              <li key={currency}>
                1 {base} = {rate} {currency}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
