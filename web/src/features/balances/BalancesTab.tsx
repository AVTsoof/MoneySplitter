import { useLiveQuery } from 'dexie-react-hooks'
import { getNetBalances } from '../../core/ledger'
import { loadGroupLedger } from '../../data/groupLedger'
import type { Uuid } from '../../data/schema'
import './BalancesTab.css'

type BalancesTabProps = {
  groupId: Uuid
}

const formatMoney = (amount: string, currency: string) => `${Number(amount).toFixed(2)} ${currency}`

export function BalancesTab({ groupId }: BalancesTabProps) {
  const balances = useLiveQuery(async () => {
    const { members, transactions } = await loadGroupLedger(groupId)
    return { members, net: getNetBalances(transactions) }
  }, [groupId])

  if (!balances) return <p>Loading balances...</p>

  const currencies = Object.keys(balances.net)

  return (
    <div className="balances-tab">
      <table aria-label="Net balances">
        <thead>
          <tr>
            <th scope="col">Member</th>
            {currencies.map((currency) => (
              <th key={currency} scope="col">
                {currency}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {balances.members.map((member) => (
            <tr key={member.id}>
              <th scope="row">{member.displayName}</th>
              {currencies.map((currency) => {
                const balance = balances.net[currency][member.displayName]
                return (
                  <td key={currency} className={balance?.isNegative() ? 'owes' : 'owed'}>
                    {formatMoney(balance?.toString() ?? '0', currency)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
