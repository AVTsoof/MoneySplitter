import { useLiveQuery } from 'dexie-react-hooks'
import { getBalancesInCurrency, getNetBalances } from '../../core/ledger'
import { getCachedExchangeRates } from '../../data/exchangeRates'
import { loadGroupLedger } from '../../data/groupLedger'
import { getGroup } from '../../data/repository'
import type { Uuid } from '../../data/schema'
import { MemberBadge } from '../common/MemberBadge'
import './BalancesTab.css'

type BalancesTabProps = {
  groupId: Uuid
}

const formatMoney = (amount: string, currency: string) => `${Number(amount).toFixed(2)} ${currency}`

export function BalancesTab({ groupId }: BalancesTabProps) {
  const balances = useLiveQuery(async () => {
    const [group, ledger] = await Promise.all([getGroup(groupId), loadGroupLedger(groupId)])
    if (!group) return null
    const rates = await getCachedExchangeRates(group.defaultCurrency)
    return {
      members: ledger.members,
      currency: group.defaultCurrency,
      net: getBalancesInCurrency(getNetBalances(ledger.transactions), group.defaultCurrency, rates),
    }
  }, [groupId])

  if (!balances) return <p>Loading balances...</p>

  return (
    <div className="balances-tab">
      <table aria-label="Net balances">
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">{balances.currency}</th>
          </tr>
        </thead>
        <tbody>
          {balances.members.map((member) => (
            <tr key={member.id}>
              <th scope="row">
                <MemberBadge member={member} />
              </th>
              <td className={balances.net[member.displayName]?.isNegative() ? 'owes' : 'owed'}>
                {formatMoney(
                  balances.net[member.displayName]?.toString() ?? '0',
                  balances.currency,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
