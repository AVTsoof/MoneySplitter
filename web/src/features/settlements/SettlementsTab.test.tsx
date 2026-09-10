import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, resetDatabase } from '../../data/db'
import {
  addExpense,
  createGroup,
  getMembers,
  getTransactions,
  updateGroup,
} from '../../data/repository'
import { SettlementsTab } from './SettlementsTab'

beforeEach(async () => {
  await resetDatabase()
})

async function twoPersonGroup() {
  const groupId = await createGroup({
    name: 'Test',
    defaultCurrency: 'EUR',
    members: ['Alice', 'Bob'],
  })
  const members = await getMembers(groupId)
  const alice = members.find((m) => m.displayName === 'Alice')!
  await addExpense({
    groupId,
    payerMemberId: alice.id,
    participantMemberIds: members.map((m) => m.id),
    amount: '30.00',
    currency: 'EUR',
    description: 'Dinner',
    strategy: { type: 'equal' },
  })
  return groupId
}

describe('SettlementsTab', () => {
  it('lists who pays whom', async () => {
    const groupId = await twoPersonGroup()
    render(<SettlementsTab groupId={groupId} />)

    const row = await screen.findByRole('listitem')
    expect(row).toHaveTextContent('Bob pays Alice')
    expect(within(row).getByLabelText('Bob color')).toBeInTheDocument()
    expect(within(row).getByLabelText('Alice color')).toBeInTheDocument()
    expect(within(row).getByText('15.00 EUR')).toBeInTheDocument()
  })

  it('records a settlement as a transfer', async () => {
    const user = userEvent.setup()
    const groupId = await twoPersonGroup()
    render(<SettlementsTab groupId={groupId} />)

    await user.click(await screen.findByRole('button', { name: 'Mark paid back' }))

    expect(await screen.findByText('Everyone is settled up.')).toBeInTheDocument()
    const transactions = await getTransactions(groupId)
    const transfer = transactions.find((t) => t.type === 'transfer')!
    expect(transfer.amount).toBe('15.00')
  })

  it('uses the group default currency for converted settlements', async () => {
    const groupId = await twoPersonGroup()
    await updateGroup(groupId, { activeCurrencies: ['EUR', 'USD'] })
    await db.exchangeRates.add({
      base: 'EUR',
      rates: { USD: '1.08' },
      fetchedAt: new Date().toISOString(),
    })
    const members = await getMembers(groupId)
    await addExpense({
      groupId,
      payerMemberId: members[0].id,
      participantMemberIds: members.map((member) => member.id),
      amount: '10.00',
      currency: 'USD',
      description: 'Coffee',
      strategy: { type: 'equal' },
    })
    render(<SettlementsTab groupId={groupId} />)

    expect(await screen.findByText('19.63 EUR')).toBeInTheDocument()
    expect(screen.queryByText('5.00 USD')).not.toBeInTheDocument()
  })
})
