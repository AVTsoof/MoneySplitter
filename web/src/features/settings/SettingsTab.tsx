import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSupportedCurrencyCodes } from '../../core/currency'
import {
  addMember,
  deleteGroup,
  getGroup,
  getMembers,
  memberHasTransactions,
  removeMember,
  renameMember,
  updateGroup,
} from '../../data/repository'
import type { Uuid } from '../../data/schema'
import './SettingsTab.css'

type SettingsTabProps = {
  groupId: Uuid
}

export function SettingsTab({ groupId }: SettingsTabProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<Uuid | null>(null)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState('')
  const [currency, setCurrency] = useState('USD')
  const members = useLiveQuery(() => getMembers(groupId), [groupId])
  const group = useLiveQuery(() => getGroup(groupId), [groupId])

  if (!members || !group) return <p>Loading settings...</p>

  const loadedGroup = group
  const availableCurrencies = getSupportedCurrencyCodes().filter(
    (code) => !loadedGroup.activeCurrencies.includes(code),
  )

  async function submitNewMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    await addMember(groupId, name)
    setNewName('')
  }

  /** A member with history cannot be deleted, or their transactions lose a payer. */
  async function attemptRemove(memberId: Uuid, displayName: string) {
    if (await memberHasTransactions(memberId)) {
      setError(`${displayName} appears in transactions and cannot be removed.`)
      return
    }
    setError('')
    await removeMember(memberId)
  }

  async function addCurrency() {
    if (!availableCurrencies.includes(currency)) return
    await updateGroup(groupId, { activeCurrencies: [...loadedGroup.activeCurrencies, currency] })
  }

  return (
    <div className="settings-tab">
      <h3>Members</h3>
      {error && <p className="settings-error">{error}</p>}
      <ul className="member-list">
        {members.map((member) => (
          <li key={member.id}>
            {editingId === member.id ? (
              <>
                <label>
                  Name for {member.displayName}
                  <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const name = draftName.trim()
                    if (name) await renameMember(member.id, name)
                    setEditingId(null)
                  }}
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <span className="member-name">{member.displayName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(member.id)
                    setDraftName(member.displayName)
                  }}
                >
                  Rename
                </button>
                <button type="button" onClick={() => attemptRemove(member.id, member.displayName)}>
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form className="add-member" onSubmit={submitNewMember}>
        <label>
          New member name
          <input value={newName} onChange={(event) => setNewName(event.target.value)} />
        </label>
        <button type="submit">Add member</button>
      </form>

      <section className="currency-settings" aria-labelledby="currencies-heading">
        <h3 id="currencies-heading">Currencies</h3>
        <p>{loadedGroup.activeCurrencies.join(', ')}</p>
        <label>
          Add currency
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {availableCurrencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={addCurrency} disabled={availableCurrencies.length === 0}>
          Add currency
        </button>
      </section>

      <section className="danger-zone" aria-labelledby="delete-group-heading">
        <h3 id="delete-group-heading">Delete group</h3>
        <button type="button" onClick={() => deleteGroup(groupId)}>
          Delete group
        </button>
      </section>
    </div>
  )
}
