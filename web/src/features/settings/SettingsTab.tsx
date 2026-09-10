import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSupportedCurrencyCodes } from '../../core/currency'
import { MEMBER_COLORS } from '../../data/memberColors'
import {
  addMember,
  deleteGroup,
  getGroup,
  getMembers,
  memberHasTransactions,
  removeMember,
  renameMember,
  setMemberColor,
  updateGroup,
} from '../../data/repository'
import type { Uuid } from '../../data/schema'
import { getTheme, setTheme, type Theme } from '../../theme'
import { MemberBadge } from '../common/MemberBadge'
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
  const [defaultCurrency, setDefaultCurrency] = useState('')
  const [colorDrafts, setColorDrafts] = useState<Record<Uuid, string>>({})
  const [theme, setThemePreference] = useState<Theme>(getTheme)
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

  async function saveDefaultCurrency() {
    const nextCurrency = defaultCurrency || loadedGroup.defaultCurrency
    if (!loadedGroup.activeCurrencies.includes(nextCurrency)) return
    await updateGroup(groupId, { defaultCurrency: nextCurrency })
    setDefaultCurrency('')
  }

  function chooseTheme(nextTheme: Theme) {
    setTheme(nextTheme)
    setThemePreference(nextTheme)
  }

  const availableMemberColors = (memberId: Uuid, currentColor: string) =>
    MEMBER_COLORS.filter(
      (color) =>
        color === currentColor ||
        !members.some((member) => member.id !== memberId && member.color === color),
    )

  async function saveMemberColor(memberId: Uuid, color: string) {
    await setMemberColor(memberId, color)
    setColorDrafts((drafts) => {
      const remaining = { ...drafts }
      delete remaining[memberId]
      return remaining
    })
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
                <span className="member-name">
                  <MemberBadge member={member} />
                </span>
                <label className="member-color-choice">
                  Color for {member.displayName}
                  <select
                    value={colorDrafts[member.id] ?? member.color}
                    onChange={(event) =>
                      setColorDrafts((drafts) => ({ ...drafts, [member.id]: event.target.value }))
                    }
                  >
                    {availableMemberColors(member.id, member.color).map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={`Save color for ${member.displayName}`}
                  onClick={() =>
                    void saveMemberColor(member.id, colorDrafts[member.id] ?? member.color)
                  }
                >
                  Save color
                </button>
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
        <label className="default-currency">
          Default currency
          <select
            value={defaultCurrency || loadedGroup.defaultCurrency}
            onChange={(event) => setDefaultCurrency(event.target.value)}
          >
            {loadedGroup.activeCurrencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={saveDefaultCurrency}>
          Save default currency
        </button>
      </section>

      <section className="theme-settings" aria-labelledby="theme-heading">
        <h3 id="theme-heading">Theme</h3>
        <div className="theme-switch" role="group" aria-label="Theme">
          {(['light', 'device', 'dark'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => chooseTheme(option)}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
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
