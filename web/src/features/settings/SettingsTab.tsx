import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addMember,
  getMembers,
  memberHasTransactions,
  removeMember,
  renameMember,
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
  const members = useLiveQuery(() => getMembers(groupId), [groupId])

  if (!members) return <p>Loading settings...</p>

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
    </div>
  )
}
