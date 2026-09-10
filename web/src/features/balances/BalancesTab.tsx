import { useLiveQuery } from 'dexie-react-hooks'
import { getNetBalances } from '../../core/ledger'
import type { Transaction } from '../../core/types'
import { getMembers, getShares, getTransactions } from '../../data/repository'
import type { Uuid } from '../../data/schema'
import './BalancesTab.css'

type BalancesTabProps = {
  groupId: Uuid
}

const formatMoney = (amount: string, currency: string) => `${Number(amount).toFixed(2)} ${currency}`

export function BalancesTab({ groupId }: BalancesTabProps) {
  const balances = useLiveQuery(async () => {
    const [members, rows] = await Promise.all([getMembers(groupId), getTransactions(groupId)])
    const names = new Map(members.map((member) => [member.id, member.displayName]))
    const transactions: Transaction[] = await Promise.all(
      rows.map(async (row) => {
        if (row.type === 'transfer') {
          return {
            kind: 'transfer' as const,
            id: row.id,
            sender: names.get(row.senderMemberId!)!,
            receiver: names.get(row.receiverMemberId!)!,
            amount: row.amount,
            currency: row.currency,
          }
        }

        const shares = await getShares(row.id)
        return {
          kind: 'expense' as const,
          id: row.id,
          payer: names.get(row.payerMemberId!)!,
          amount: row.amount,
          currency: row.currency,
          participants: shares.map((share) => names.get(share.memberId)!),
          strategy: {
            type: 'exact' as const,
            amounts: Object.fromEntries(
              shares.map((share) => [names.get(share.memberId)!, share.amount]),
            ),
          },
        }
      }),
    )
    return { members, net: getNetBalances(transactions) }
  }, [groupId])

  if (!balances) return <p>Loading balances...</p>

  return (
    <div className="balances-tab">
      <table aria-label="Net balances">
        <thead>
          <tr>
            <th scope="col">Member</th>
            {Object.keys(balances.net).map((currency) => (
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
              {Object.entries(balances.net).map(([currency, perMember]) => (
                <td
                  key={currency}
                  className={perMember[member.displayName]?.isNegative() ? 'owes' : 'owed'}
                >
                  {formatMoney(perMember[member.displayName]?.toString() ?? '0', currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
