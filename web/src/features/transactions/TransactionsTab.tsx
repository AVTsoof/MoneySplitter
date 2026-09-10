import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addExpense,
  addTransfer,
  deleteTransaction,
  getGroup,
  getMembers,
  getTransactions,
  updateTransaction,
} from '../../data/repository'
import type { Uuid } from '../../data/schema'
import { downloadPdfReport } from '../reports/pdfReport'
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
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false)
  const [senderMemberId, setSenderMemberId] = useState('')
  const [receiverMemberId, setReceiverMemberId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [editingTransactionId, setEditingTransactionId] = useState<Uuid | null>(null)
  const [editedDescription, setEditedDescription] = useState('')
  const ledger = useLiveQuery(async () => {
    const [group, members, transactions] = await Promise.all([
      getGroup(groupId),
      getMembers(groupId),
      getTransactions(groupId),
    ])
    const memberNames = new Map(members.map((member) => [member.id, member.displayName]))
    return { group, memberNames, members, transactions }
  }, [groupId])

  if (!ledger) {
    return <p>Loading transactions...</p>
  }

  const { group, memberNames, members, transactions } = ledger
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

  async function saveTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const sender = senderMemberId || members[0]?.id
    const receiver = receiverMemberId || members[1]?.id
    if (!sender || !receiver || sender === receiver || !transferAmount) return

    await addTransfer({
      groupId,
      senderMemberId: sender,
      receiverMemberId: receiver,
      amount: transferAmount,
      currency: 'EUR',
      description: `Transfer from ${memberNames.get(sender)} to ${memberNames.get(receiver)}`,
    })
    setSenderMemberId('')
    setReceiverMemberId('')
    setTransferAmount('')
    setIsTransferFormOpen(false)
  }

  async function saveDescription(transactionId: Uuid) {
    const description = editedDescription.trim()
    if (!description) return
    await updateTransaction(transactionId, { description })
    setEditingTransactionId(null)
  }

  return (
    <div className="transactions-tab">
      <button className="add-bill" type="button" onClick={() => setIsFormOpen(true)}>
        Add bill
      </button>
      <button className="add-bill" type="button" onClick={() => setIsTransferFormOpen(true)}>
        Add transfer
      </button>
      <button
        className="add-bill"
        type="button"
        onClick={() =>
          downloadPdfReport(
            group?.name ?? 'MoneySplitter',
            transactions.map((transaction) => ({
              description: displayDescription(transaction.description),
              counterparty:
                transaction.type === 'expense'
                  ? `Paid by ${memberNames.get(transaction.payerMemberId!)}`
                  : `${memberNames.get(transaction.senderMemberId!)} paid ${memberNames.get(transaction.receiverMemberId!)}`,
              amount: money(transaction.amount, transaction.currency),
            })),
          )
        }
      >
        Export PDF
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
      {isTransferFormOpen && (
        <form className="bill-form" onSubmit={saveTransfer}>
          <label>
            From
            <select
              value={senderMemberId}
              onChange={(event) => setSenderMemberId(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select
              value={receiverMemberId || members[1]?.id || ''}
              onChange={(event) => setReceiverMemberId(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            How much?
            <input
              min="0.01"
              step="0.01"
              type="number"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
              required
            />
          </label>
          <button type="submit">Save transfer</button>
          <button type="button" onClick={() => setIsTransferFormOpen(false)}>
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
                {editingTransactionId === transaction.id ? (
                  <label className="edit-description">
                    Description
                    <input
                      value={editedDescription}
                      onChange={(event) => setEditedDescription(event.target.value)}
                    />
                  </label>
                ) : (
                  <p className="transaction-description">
                    {displayDescription(transaction.description)}
                  </p>
                )}
                <p className="transaction-meta">{counterparty}</p>
              </div>
              <div className="transaction-actions">
                <strong>{money(transaction.amount, transaction.currency)}</strong>
                {editingTransactionId === transaction.id ? (
                  <button
                    type="button"
                    aria-label="Save changes"
                    onClick={() => saveDescription(transaction.id)}
                  >
                    Save
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Edit bill"
                    title="Edit bill"
                    onClick={() => {
                      setEditingTransactionId(transaction.id)
                      setEditedDescription(transaction.description)
                    }}
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete bill"
                  title="Delete bill"
                  onClick={() => deleteTransaction(transaction.id)}
                >
                  x
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
