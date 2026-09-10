import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { db } from '../../data/db'
import { resetDatabase } from '../../data/db'
import {
  addExpense,
  addTransfer,
  createGroup,
  getMembers,
  seedExampleGroup,
  updateGroup,
} from '../../data/repository'
import { TransactionsTab } from './TransactionsTab'

beforeEach(async () => {
  await resetDatabase()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TransactionsTab', () => {
  it('shows the seeded ledger with member names and amounts', async () => {
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    const leonardo = await screen.findByText('Leonardo Express train - Fiumicino to Roma Termini')
    const row = leonardo.closest('li')!
    expect(within(row).getByText('70.00 EUR')).toBeInTheDocument()
    expect(row).toHaveTextContent('Paid by Alice')
    expect(within(row).getByText('Bill')).toBeInTheDocument()
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
    expect(row).toHaveTextContent('Paid by Alice')
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
    expect(
      screen.getAllByRole('listitem').some((item) => item.textContent === 'Alice: +10.00 EUR'),
    ).toBe(true)
    expect(
      screen.getAllByRole('listitem').some((item) => item.textContent === 'Bob: -10.00 EUR'),
    ).toBe(true)
    expect(
      screen.getAllByRole('listitem').some((item) => item.textContent === 'Charlie: +0.00 EUR'),
    ).toBe(true)
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

  it('shows a non-default entry with its cached default-currency conversion', async () => {
    const groupId = await createGroup({
      name: 'Test',
      defaultCurrency: 'EUR',
      members: ['Alice'],
    })
    await updateGroup(groupId, { activeCurrencies: ['EUR', 'USD'] })
    await db.exchangeRates.add({
      base: 'EUR',
      rates: { USD: '1.08' },
      fetchedAt: new Date().toISOString(),
    })
    const [alice] = await getMembers(groupId)
    await addExpense({
      groupId,
      payerMemberId: alice.id,
      participantMemberIds: [alice.id],
      amount: '10.00',
      currency: 'USD',
      description: 'Coffee',
      strategy: { type: 'equal' },
    })
    render(<TransactionsTab groupId={groupId} />)

    expect(await screen.findByText('10.00 USD (9.26 EUR)')).toBeInTheDocument()
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
    expect(row).toHaveTextContent('Bob paid Alice')
    expect(within(row).getByText('Transfer')).toBeInTheDocument()
  })

  it('removes a transaction from the live history', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
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

  it('keeps a transaction when deletion is cancelled', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    const description = await screen.findByText(
      'Leonardo Express train - Fiumicino to Roma Termini',
    )
    fireEvent.click(within(description.closest('li')!).getByRole('button', { name: 'Delete bill' }))

    expect(confirm).toHaveBeenCalledWith('Delete this entry? This cannot be undone.')
    expect(screen.getByText('34 entries')).toBeInTheDocument()
  })

  it('edits a transaction description', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    const description = await screen.findByText(
      'Leonardo Express train - Fiumicino to Roma Termini',
    )
    const row = description.closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Edit bill' }))
    fireEvent.change(await within(row).findByLabelText('Description'), {
      target: { value: 'Airport train' },
    })
    fireEvent.click(within(row).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Airport train')).toBeInTheDocument()
  })

  it('opens original expense fields, marks changes, and confirms before saving', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    const row = (
      await screen.findByText('Leonardo Express train - Fiumicino to Roma Termini')
    ).closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Edit bill' }))
    expect(await within(row).findByLabelText('Amount')).toHaveValue(70)
    expect(within(row).getByLabelText('Currency')).toHaveValue('EUR')
    fireEvent.change(within(row).getByLabelText('Description'), {
      target: { value: 'Airport train' },
    })
    expect(within(row).getByLabelText('Description')).toHaveAttribute('data-changed', 'true')
    expect(within(row).getByText('*')).toHaveClass('changed-marker')
    fireEvent.click(within(row).getByRole('button', { name: 'Save changes' }))

    expect(confirm).toHaveBeenCalledWith('Save these entry changes?')
    expect(within(row).getByLabelText('Description')).toHaveValue('Airport train')
  })

  it('uses the bill form for editing and discards changes on Cancel', async () => {
    const groupId = await seedExampleGroup()
    render(<TransactionsTab groupId={groupId} />)

    const row = (
      await screen.findByText('Leonardo Express train - Fiumicino to Roma Termini')
    ).closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Edit bill' }))
    const form = await within(row).findByRole('form')
    expect(form).toHaveClass('bill-form')
    fireEvent.change(within(form).getByLabelText('Description'), {
      target: { value: 'Airport train' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))

    expect(
      await screen.findByText('Leonardo Express train - Fiumicino to Roma Termini'),
    ).toBeInTheDocument()
  })

  it('uses the transfer form for editing and discards changes on Cancel', async () => {
    const groupId = await createGroup({
      name: 'Test',
      defaultCurrency: 'EUR',
      members: ['Alice', 'Bob'],
    })
    const members = await getMembers(groupId)
    await addTransfer({
      groupId,
      senderMemberId: members[1].id,
      receiverMemberId: members[0].id,
      amount: '10.00',
      currency: 'EUR',
      description: 'Payback',
    })
    render(<TransactionsTab groupId={groupId} />)

    const row = (await screen.findByText('Payback')).closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Edit bill' }))
    const form = await within(row).findByRole('form')
    expect(form).toHaveClass('bill-form')
    expect(within(form).getByLabelText('From')).toHaveValue(members[1].id)
    expect(within(form).getByLabelText('To')).toHaveValue(members[0].id)
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Payback')).toBeInTheDocument()
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
    expect(
      screen.getAllByRole('listitem').some((item) => item.textContent === 'Alice: +15.00 EUR'),
    ).toBe(true)
    expect(
      screen.getAllByRole('listitem').some((item) => item.textContent === 'Bob: -15.00 EUR'),
    ).toBe(true)
  })

  it('shows timestamped entries newest first and groups them by day', async () => {
    const groupId = await createGroup({ name: 'Test', defaultCurrency: 'EUR', members: ['Alice'] })
    const [alice] = await getMembers(groupId)
    await addExpense({
      groupId,
      payerMemberId: alice.id,
      participantMemberIds: [alice.id],
      amount: '1.00',
      currency: 'EUR',
      description: 'Older',
      occurredAt: '2026-01-01T10:00:00.000Z',
      strategy: { type: 'equal' },
    })
    await addExpense({
      groupId,
      payerMemberId: alice.id,
      participantMemberIds: [alice.id],
      amount: '2.00',
      currency: 'EUR',
      description: 'Newer',
      occurredAt: '2026-01-02T10:00:00.000Z',
      strategy: { type: 'equal' },
    })
    render(<TransactionsTab groupId={groupId} />)

    expect(await screen.findByRole('heading', { name: '2026-01-02' })).toBeInTheDocument()
    expect(screen.getByText(/2026-01-02 10:00/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2026-01-02' }).closest('li')).not.toHaveTextContent(
      'Newer',
    )
    const entries = screen
      .getAllByRole('listitem')
      .filter((item) => item.textContent?.includes('Older') || item.textContent?.includes('Newer'))
    expect(entries[0]).toHaveTextContent('Newer')
    expect(screen.queryByLabelText('Group entries by')).not.toBeInTheDocument()
  })
})
