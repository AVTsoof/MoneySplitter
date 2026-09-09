import { useLiveQuery } from 'dexie-react-hooks'
import { getMembers, getTransactions } from '../../data/repository'
import type { Uuid } from '../../data/schema'
import './TransactionsTab.css'

type TransactionsTabProps = {
  groupId: Uuid
}

const money = (amount: string, currency: string) => `${Number(amount).toFixed(2)} ${currency}`
const displayDescription = (description: string) => description.replaceAll('\u2013', '-')

export function TransactionsTab({ groupId }: TransactionsTabProps) {
  const ledger = useLiveQuery(async () => {
    const [members, transactions] = await Promise.all([
      getMembers(groupId),
      getTransactions(groupId),
    ])
    const memberNames = new Map(members.map((member) => [member.id, member.displayName]))
    return { memberNames, transactions }
  }, [groupId])

  if (!ledger) {
    return <p>Loading transactions...</p>
  }

  return (
    <div className="transactions-tab">
      <p className="transaction-count">{ledger.transactions.length} entries</p>
      <ol className="transaction-list">
        {ledger.transactions.map((transaction) => {
          const counterparty =
            transaction.type === 'expense'
              ? `Paid by ${ledger.memberNames.get(transaction.payerMemberId!)}`
              : `${ledger.memberNames.get(transaction.senderMemberId!)} paid ${ledger.memberNames.get(transaction.receiverMemberId!)}`

          return (
            <li key={transaction.id} className="transaction-row">
              <div>
                <p className="transaction-description">
                  {displayDescription(transaction.description)}
                </p>
                <p className="transaction-meta">{counterparty}</p>
              </div>
              <strong>{money(transaction.amount, transaction.currency)}</strong>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
