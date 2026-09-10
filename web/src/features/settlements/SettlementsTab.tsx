import { useLiveQuery } from 'dexie-react-hooks'
import { getNetBalances } from '../../core/ledger'
import { simplifyDebts } from '../../core/debtSimplifier'
import { loadGroupLedger } from '../../data/groupLedger'
import { addTransfer } from '../../data/repository'
import type { Uuid } from '../../data/schema'
import { MemberBadge } from '../common/MemberBadge'
import './SettlementsTab.css'

type SettlementsTabProps = {
  groupId: Uuid
}

export function SettlementsTab({ groupId }: SettlementsTabProps) {
  const plan = useLiveQuery(async () => {
    const { members, transactions } = await loadGroupLedger(groupId)
    const idsByName = new Map(members.map((member) => [member.displayName, member.id]))
    const membersByName = new Map(members.map((member) => [member.displayName, member]))
    const byCurrency = simplifyDebts(getNetBalances(transactions))

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
