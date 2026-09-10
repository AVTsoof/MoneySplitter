import { useLiveQuery } from 'dexie-react-hooks'
import { getBalancesInCurrency, getNetBalances } from '../../core/ledger'
import { simplifyDebts } from '../../core/debtSimplifier'
import { getCachedExchangeRates } from '../../data/exchangeRates'
import { loadGroupLedger } from '../../data/groupLedger'
import { addTransfer, getGroup } from '../../data/repository'
import type { Uuid } from '../../data/schema'
import { MemberBadge } from '../common/MemberBadge'
import './SettlementsTab.css'

type SettlementsTabProps = {
  groupId: Uuid
}

export function SettlementsTab({ groupId }: SettlementsTabProps) {
  const plan = useLiveQuery(async () => {
    const [group, ledger] = await Promise.all([getGroup(groupId), loadGroupLedger(groupId)])
    if (!group) return null
    const { members, transactions } = ledger
    const idsByName = new Map(members.map((member) => [member.displayName, member.id]))
    const membersByName = new Map(members.map((member) => [member.displayName, member]))
    const rates = await getCachedExchangeRates(group.defaultCurrency)
    const byCurrency = simplifyDebts({
      [group.defaultCurrency]: getBalancesInCurrency(
        getNetBalances(transactions),
        group.defaultCurrency,
        rates,
      ),
    })

    return {
      idsByName,
      membersByName,
      settlements: Object.entries(byCurrency).flatMap(([currency, list]) =>
        list.map((settlement) => ({ ...settlement, currency })),
      ),
    }
  }, [groupId])

  if (!plan) return <p>Loading settlements...</p>

  if (plan.settlements.length === 0) {
    return <p className="settled-up">Everyone is settled up.</p>
  }

  return (
    <ol className="settlement-list">
      {plan.settlements.map((settlement) => (
        <li key={`${settlement.currency}-${settlement.from}-${settlement.to}`}>
          <div>
            <p className="settlement-parties">
              <MemberBadge member={plan.membersByName.get(settlement.from)!} /> pays{' '}
              <MemberBadge member={plan.membersByName.get(settlement.to)!} />
            </p>
            <p className="settlement-amount">
              {settlement.amount} {settlement.currency}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              addTransfer({
                groupId,
                senderMemberId: plan.idsByName.get(settlement.from)!,
                receiverMemberId: plan.idsByName.get(settlement.to)!,
                amount: settlement.amount,
                currency: settlement.currency,
                description: `Settle up: ${settlement.from} to ${settlement.to}`,
              })
            }
          >
            Mark paid back
          </button>
        </li>
      ))}
    </ol>
  )
}
