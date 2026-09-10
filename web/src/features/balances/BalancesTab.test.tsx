import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { db, resetDatabase } from '../../data/db'
import { addExpense, createGroup, getMembers, updateGroup } from '../../data/repository'
import { BalancesTab } from './BalancesTab'

beforeEach(async () => {
  await resetDatabase()
})

describe('BalancesTab', () => {
  it('reports all balances in the group default currency from cached rates', async () => {
    const groupId = await createGroup({
      name: 'Trip',
      defaultCurrency: 'EUR',
      members: ['Alice', 'Bob'],
    })
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
    render(<BalancesTab groupId={groupId} />)

    const table = await screen.findByRole('table', { name: 'Net balances' })
    expect(table).toHaveTextContent('EUR')
    expect(table).not.toHaveTextContent('USD')
    expect(table).toHaveTextContent('4.63 EUR')
    expect(table).toHaveTextContent('-4.63 EUR')
  })
})
