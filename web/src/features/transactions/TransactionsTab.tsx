import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addExpense, getMembers, getTransactions } from '../../data/repository'
import type { Uuid } from '../../data/schema'
import './TransactionsTab.css'

type TransactionsTabProps = {
  groupId: Uuid
}

const money = (amount: string, currency: string) => `${Number(amount).toFixed(2)} ${currency}`
const displayDescription = (description: string) => description.replaceAll('\u2013', '-')

export function TransactionsTab({ groupId }: TransactionsTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerMemberId, setPayerMemberId] = useState('')
  const ledger = useLiveQuery(async () => {
    const [members, transactions] = await Promise.all([
      getMembers(groupId),
      getTransactions(groupId),
    ])
    const memberNames = new Map(members.map((member) => [member.id, member.displayName]))
    return { memberNames, members, transactions }
  }, [groupId])

  if (!ledger) {
    return <p>Loading transactions...</p>
  }

  const { memberNames, members, transactions } = ledger
  const defaultPayerId = payerMemberId || members[0]?.id || ''

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!description.trim() || !amount || !defaultPayerId) return

    await addExpense({
      groupId,
      payerMemberId: defaultPayerId,
      participantMemberIds: members.map((member) => member.id),
      amount,
      currency: 'EUR',
      description: description.trim(),
      strategy: { type: 'equal' },
    })
    setDescription('')
    setAmount('')
    setPayerMemberId('')
    setIsFormOpen(false)
  }

  return (
    <div className="transactions-tab">
      <button className="add-bill" type="button" onClick={() => setIsFormOpen(true)}>
        Add bill
      </button>
      {isFormOpen && (
        <form className="bill-form" onSubmit={saveExpense}>
          <label>
            What was it for?
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </label>
          <label>
            How much?
            <input
              min="0.01"
              step="0.01"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label>
            Paid by
            <select
              value={defaultPayerId}
              onChange={(event) => setPayerMemberId(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Save bill</button>
          <button type="button" onClick={() => setIsFormOpen(false)}>
            Cancel
          </button>
        </form>
      )}
      <p className="transaction-count">{transactions.length} entries</p>
      <ol className="transaction-list">
        {transactions.map((transaction) => {
          const counterparty =
            transaction.type === 'expense'
              ? `Paid by ${memberNames.get(transaction.payerMemberId!)}`
              : `${memberNames.get(transaction.senderMemberId!)} paid ${memberNames.get(transaction.receiverMemberId!)}`

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
