import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
})
