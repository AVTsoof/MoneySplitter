import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDatabase } from '../../data/db'
import { createGroup, addExpense, getMembers } from '../../data/repository'
import { SettingsTab } from './SettingsTab'

beforeEach(async () => {
  await resetDatabase()
})

const group = () => createGroup({ name: 'Trip', defaultCurrency: 'EUR', members: ['Alice', 'Bob'] })

describe('SettingsTab', () => {
  it('adds a member', async () => {
    const user = userEvent.setup()
    const groupId = await group()
    render(<SettingsTab groupId={groupId} />)

    await user.type(await screen.findByLabelText('New member name'), 'Charlie')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    expect(await screen.findByText('Charlie')).toBeInTheDocument()
    expect(await getMembers(groupId)).toHaveLength(3)
  })

  it('removes a member who has no transactions', async () => {
    const user = userEvent.setup()
    const groupId = await group()
    render(<SettingsTab groupId={groupId} />)

    const row = (await screen.findByText('Bob')).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument())
    expect(await getMembers(groupId)).toHaveLength(1)
  })

  it('renames a member without touching their transactions', async () => {
    const user = userEvent.setup()
    const groupId = await group()
    render(<SettingsTab groupId={groupId} />)

    const row = (await screen.findByText('Alice')).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Rename' }))
    const input = within(row).getByLabelText('Name for Alice')
    await user.clear(input)
    await user.type(input, 'Alicia')
    await user.click(within(row).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Alicia')).toBeInTheDocument()
  })

  it('refuses to remove a member who appears in transactions', async () => {
    const user = userEvent.setup()
    const groupId = await group()
    const members = await getMembers(groupId)
    await addExpense({
      groupId,
      payerMemberId: members[0].id,
      participantMemberIds: members.map((m) => m.id),
      amount: '10.00',
      currency: 'EUR',
      description: 'Coffee',
      strategy: { type: 'equal' },
    })
    render(<SettingsTab groupId={groupId} />)

    const row = (await screen.findByText('Bob')).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Remove' }))

    expect(
      await screen.findByText('Bob appears in transactions and cannot be removed.'),
    ).toBeInTheDocument()
    expect(await getMembers(groupId)).toHaveLength(2)
  })
})
