import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { resetDatabase } from '../../data/db'
import {
  addExpense,
  createGroup,
  getMembers,
  seedExampleGroup,
  updateGroup,
} from '../../data/repository'
import { TransactionsTab } from './TransactionsTab'

beforeEach(async () => {
  await resetDatabase()
})

describe('TransactionsTab', () => {
  it('shows the seeded ledger with member names and amounts', async () => {
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    const leonardo = await screen.findByText('Leonardo Express train - Fiumicino to Roma Termini')
    const row = leonardo.closest('li')!
    expect(within(row).getByText('70.00 EUR')).toBeInTheDocument()
    expect(within(row).getByText('Paid by Alice')).toBeInTheDocument()
    expect(screen.getByText('34 entries')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument()
  })

  it('adds an equal-split expense for all group members', async () => {
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    await screen.findByText('34 entries')
    fireEvent.click(screen.getByRole('button', { name: 'Add bill' }))
    fireEvent.change(screen.getByLabelText('What was it for?'), {
      target: { value: 'Gelato' },
    })
    fireEvent.change(screen.getByLabelText('How much?'), { target: { value: '25.00' } })
    fireEvent.change(screen.getByLabelText('Paid by'), {
      target: { value: '2ba7fcb7-4d24-4419-acf2-000000000001' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save bill' }))

    expect(await screen.findByText('35 entries')).toBeInTheDocument()
    const row = screen.getByText('Gelato').closest('li')!
    expect(within(row).getByText('25.00 EUR')).toBeInTheDocument()
    expect(within(row).getByText('Paid by Alice')).toBeInTheDocument()
  })

  it('lets the payer choose bill participants', async () => {
    const groupId = await createGroup({
      name: 'Test',
      defaultCurrency: 'EUR',
      members: ['Alice', 'Bob', 'Charlie'],
    })
    const members = await getMembers(groupId)
    render(<TransactionsTab groupId={groupId} />)

    await screen.findByText('0 entries')
    fireEvent.click(screen.getByRole('button', { name: 'Add bill' }))
    fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value: 'Coffee' } })
    fireEvent.change(screen.getByLabelText('How much?'), { target: { value: '20.00' } })
    fireEvent.click(screen.getByLabelText('Charlie'))
    fireEvent.click(screen.getByRole('button', { name: 'Save bill' }))

    expect(await screen.findByText('1 entries')).toBeInTheDocument()
    expect(await screen.findByText('Alice: +10.00 EUR')).toBeInTheDocument()
    expect(screen.getByText('Bob: -10.00 EUR')).toBeInTheDocument()
    expect(screen.getByText('Charlie: +0.00 EUR')).toBeInTheDocument()
    expect(members).toHaveLength(3)
  })

  it('records a bill in an active group currency', async () => {
    const groupId = await createGroup({
      name: 'Test',
      defaultCurrency: 'EUR',
      members: ['Alice'],
    })
    await updateGroup(groupId, { activeCurrencies: ['EUR', 'USD'] })
    render(<TransactionsTab groupId={groupId} />)

    await screen.findByText('0 entries')
    fireEvent.click(screen.getByRole('button', { name: 'Add bill' }))
    fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value: 'Coffee' } })
    fireEvent.change(screen.getByLabelText('How much?'), { target: { value: '5.00' } })
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save bill' }))

    expect(await screen.findByText('5.00 USD')).toBeInTheDocument()
  })

  it('records a transfer between group members', async () => {
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    await screen.findByText('34 entries')
    fireEvent.click(screen.getByRole('button', { name: 'Add transfer' }))
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2ba7fcb7-4d24-4419-acf2-000000000003' },
    })
    fireEvent.change(screen.getByLabelText('To'), {
      target: { value: '2ba7fcb7-4d24-4419-acf2-000000000001' },
    })
    fireEvent.change(screen.getByLabelText('How much?'), { target: { value: '10.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save transfer' }))

    expect(await screen.findByText('35 entries')).toBeInTheDocument()
    const row = screen.getByText('Transfer from Bob to Alice').closest('li')!
    expect(within(row).getByText('10.00 EUR')).toBeInTheDocument()
    expect(within(row).getByText('Bob paid Alice')).toBeInTheDocument()
  })

  it('removes a transaction from the live history', async () => {
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    const description = await screen.findByText(
      'Leonardo Express train - Fiumicino to Roma Termini',
    )
    await screen.findByText('34 entries')
    fireEvent.click(within(description.closest('li')!).getByRole('button', { name: 'Delete bill' }))

    expect(await screen.findByText('33 entries')).toBeInTheDocument()
    expect(
      screen.queryByText('Leonardo Express train - Fiumicino to Roma Termini'),
    ).not.toBeInTheDocument()
  })

  it('edits a transaction description', async () => {
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    const description = await screen.findByText(
      'Leonardo Express train - Fiumicino to Roma Termini',
    )
    const row = description.closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Edit bill' }))
    fireEvent.change(within(row).getByLabelText('Description'), {
      target: { value: 'Airport train' },
    })
    fireEvent.click(within(row).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Airport train')).toBeInTheDocument()
  })

  it("shows each member's running bottom line", async () => {
    const groupId = await createGroup({
      name: 'Test',
      defaultCurrency: 'EUR',
      members: ['Alice', 'Bob'],
    })
    const members = await getMembers(groupId)
    await addExpense({
      groupId,
      payerMemberId: members[0].id,
      participantMemberIds: members.map((member) => member.id),
      amount: '30.00',
      currency: 'EUR',
      description: 'Dinner',
      strategy: { type: 'equal' },
    })
    render(<TransactionsTab groupId={groupId} />)

    expect(await screen.findByText('The Bottom Line')).toBeInTheDocument()
    expect(screen.getByText('Alice: +15.00 EUR')).toBeInTheDocument()
    expect(screen.getByText('Bob: -15.00 EUR')).toBeInTheDocument()
  })
})
