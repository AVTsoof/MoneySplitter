import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getNetBalances } from '../../core/ledger'
import { loadGroupLedger } from '../../data/groupLedger'
import {
  addExpense,
  addTransfer,
  deleteTransaction,
  getGroup,
  getShares,
  updateExpense,
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

type EditDraft = {
  description: string
  amount: string
  currency: string
  payerMemberId: Uuid
  participantMemberIds: Uuid[]
  occurredAt: string
}

export function TransactionsTab({ groupId }: TransactionsTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerMemberId, setPayerMemberId] = useState('')
  const [participantMemberIds, setParticipantMemberIds] = useState<Uuid[]>([])
  const [currency, setCurrency] = useState('EUR')
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false)
  const [senderMemberId, setSenderMemberId] = useState('')
  const [receiverMemberId, setReceiverMemberId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferCurrency, setTransferCurrency] = useState('EUR')
  const [editingTransactionId, setEditingTransactionId] = useState<Uuid | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [originalDraft, setOriginalDraft] = useState<EditDraft | null>(null)
  const ledger = useLiveQuery(async () => {
    const [group, groupLedger] = await Promise.all([getGroup(groupId), loadGroupLedger(groupId)])
    const memberNames = new Map(
      groupLedger.members.map((member) => [member.id, member.displayName]),
    )
    return {
      group,
      memberNames,
      members: groupLedger.members,
      netBalances: getNetBalances(groupLedger.transactions),
      transactions: groupLedger.rows,
    }
  }, [groupId])

  if (!ledger) {
    return <p>Loading transactions...</p>
  }

  const { group, memberNames, members, netBalances, transactions } = ledger
  const defaultPayerId = payerMemberId || members[0]?.id || ''
  const activeCurrencies = group?.activeCurrencies ?? ['EUR']

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!description.trim() || !amount || !defaultPayerId) return

    await addExpense({
      groupId,
      payerMemberId: defaultPayerId,
      participantMemberIds,
      amount,
      currency,
      description: description.trim(),
      strategy: { type: 'equal' },
    })
    setDescription('')
    setAmount('')
    setPayerMemberId('')
    setParticipantMemberIds([])
    setCurrency(group?.defaultCurrency ?? 'EUR')
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
      currency: transferCurrency,
      description: `Transfer from ${memberNames.get(sender)} to ${memberNames.get(receiver)}`,
    })
    setSenderMemberId('')
    setReceiverMemberId('')
    setTransferAmount('')
    setTransferCurrency(group?.defaultCurrency ?? 'EUR')
    setIsTransferFormOpen(false)
  }

  async function openEditor(transaction: (typeof transactions)[number]) {
    if (transaction.type === 'transfer') {
      const draft = {
        description: transaction.description,
        amount: transaction.amount,
        currency: transaction.currency,
        payerMemberId: '',
        participantMemberIds: [],
        occurredAt: transaction.occurredAt,
      }
      setOriginalDraft(draft)
      setEditDraft(draft)
      setEditingTransactionId(transaction.id)
      return
    }
    const shares = await getShares(transaction.id)
    const draft = {
      description: transaction.description,
      amount: transaction.amount,
      currency: transaction.currency,
      payerMemberId: transaction.payerMemberId!,
      participantMemberIds: shares.map((share) => share.memberId),
      occurredAt: transaction.occurredAt,
    }
    setOriginalDraft(draft)
    setEditDraft(draft)
    setEditingTransactionId(transaction.id)
  }

  async function saveTransaction(transaction: (typeof transactions)[number]) {
    if (!editDraft || !window.confirm('Save these entry changes?')) return
    if (transaction.type === 'expense') {
      await updateExpense(transaction.id, {
        groupId,
        payerMemberId: editDraft.payerMemberId,
        participantMemberIds: editDraft.participantMemberIds,
        amount: editDraft.amount,
        currency: editDraft.currency,
        description: editDraft.description.trim(),
        occurredAt: editDraft.occurredAt,
        strategy: { type: 'equal' },
      })
    } else {
      await updateTransaction(transaction.id, {
        amount: editDraft.amount,
        currency: editDraft.currency,
        description: editDraft.description.trim(),
        occurredAt: editDraft.occurredAt,
      })
    }
    setEditingTransactionId(null)
    setEditDraft(null)
    setOriginalDraft(null)
  }

  function removeTransaction(transactionId: Uuid) {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return
    void deleteTransaction(transactionId)
  }

  return (
    <div className="transactions-tab">
      <button
        className="add-bill"
        type="button"
        onClick={() => {
          setParticipantMemberIds(members.map((member) => member.id))
          setCurrency(group?.defaultCurrency ?? 'EUR')
          setIsFormOpen(true)
        }}
      >
        Add bill
      </button>
      <button
        className="add-bill"
        type="button"
        onClick={() => {
          setTransferCurrency(group?.defaultCurrency ?? 'EUR')
          setIsTransferFormOpen(true)
        }}
      >
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
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {activeCurrencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
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
          <fieldset className="participants">
            <legend>Who was there?</legend>
            {members.map((member) => (
              <label key={member.id}>
                <input
                  type="checkbox"
                  checked={participantMemberIds.includes(member.id)}
                  onChange={() =>
                    setParticipantMemberIds((current) =>
                      current.includes(member.id)
                        ? current.filter((id) => id !== member.id)
                        : [...current, member.id],
                    )
                  }
                />
                {member.displayName}
              </label>
            ))}
          </fieldset>
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
          <label>
            Currency
            <select
              value={transferCurrency}
              onChange={(event) => setTransferCurrency(event.target.value)}
            >
              {activeCurrencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Save transfer</button>
          <button type="button" onClick={() => setIsTransferFormOpen(false)}>
            Cancel
          </button>
        </form>
      )}
      <section className="running-balances" aria-labelledby="bottom-line-heading">
        <h3 id="bottom-line-heading">The Bottom Line</h3>
        {Object.entries(netBalances).map(([currency, balances]) => (
          <ul key={currency}>
            {members.map((member) => {
              const balance = balances[member.displayName]
              const amount = balance?.toFixed(2) ?? '0.00'
              const sign = balance?.isNegative() ? '' : '+'
              return (
                <li key={member.id}>
                  {member.displayName}: {sign}
                  {amount} {currency}
                </li>
              )
            })}
          </ul>
        ))}
      </section>
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
                  <div className="entry-editor">
                    <label>
                      Description
                      <input
                        data-changed={editDraft?.description !== originalDraft?.description}
                        value={editDraft?.description ?? ''}
                        onChange={(event) =>
                          setEditDraft(
                            (draft) => draft && { ...draft, description: event.target.value },
                          )
                        }
                      />
                    </label>
                    <label>
                      Amount
                      <input
                        data-changed={editDraft?.amount !== originalDraft?.amount}
                        min="0.01"
                        step="0.01"
                        type="number"
                        value={editDraft?.amount ?? ''}
                        onChange={(event) =>
                          setEditDraft((draft) => draft && { ...draft, amount: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Currency
                      <select
                        data-changed={editDraft?.currency !== originalDraft?.currency}
                        value={editDraft?.currency ?? ''}
                        onChange={(event) =>
                          setEditDraft(
                            (draft) => draft && { ...draft, currency: event.target.value },
                          )
                        }
                      >
                        {activeCurrencies.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Timestamp
                      <input
                        data-changed={editDraft?.occurredAt !== originalDraft?.occurredAt}
                        type="datetime-local"
                        value={editDraft?.occurredAt.slice(0, 16) ?? ''}
                        onChange={(event) =>
                          setEditDraft(
                            (draft) =>
                              draft && {
                                ...draft,
                                occurredAt: new Date(event.target.value).toISOString(),
                              },
                          )
                        }
                      />
                    </label>
                    {transaction.type === 'expense' && (
                      <>
                        <label>
                          Paid by
                          <select
                            data-changed={editDraft?.payerMemberId !== originalDraft?.payerMemberId}
                            value={editDraft?.payerMemberId ?? ''}
                            onChange={(event) =>
                              setEditDraft(
                                (draft) => draft && { ...draft, payerMemberId: event.target.value },
                              )
                            }
                          >
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <fieldset className="participants">
                          <legend>Who was there?</legend>
                          {members.map((member) => (
                            <label key={member.id}>
                              <input
                                type="checkbox"
                                checked={
                                  editDraft?.participantMemberIds.includes(member.id) ?? false
                                }
                                onChange={() =>
                                  setEditDraft(
                                    (draft) =>
                                      draft && {
                                        ...draft,
                                        participantMemberIds: draft.participantMemberIds.includes(
                                          member.id,
                                        )
                                          ? draft.participantMemberIds.filter(
                                              (id) => id !== member.id,
                                            )
                                          : [...draft.participantMemberIds, member.id],
                                      },
                                  )
                                }
                              />
                              {member.displayName}
                            </label>
                          ))}
                        </fieldset>
                      </>
                    )}
                  </div>
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
                    onClick={() => saveTransaction(transaction)}
                  >
                    Save
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Edit bill"
                    title="Edit bill"
                    onClick={() => void openEditor(transaction)}
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete bill"
                  title="Delete bill"
                  onClick={() => removeTransaction(transaction.id)}
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
