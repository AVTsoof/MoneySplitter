import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { resetDatabase } from '../../data/db'
import { seedExampleGroup } from '../../data/repository'
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
})
