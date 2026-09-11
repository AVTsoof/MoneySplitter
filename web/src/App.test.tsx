import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDatabase } from './data/db'
import { createGroup } from './data/repository'
import App from './App'

beforeEach(async () => {
  await resetDatabase()
})

describe('App', () => {
  it('seeds the example group and switches between workspace tabs', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Example Italy Trip' })).toBeInTheDocument()
    expect(screen.getByText('💸')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.getByText('🧾')).toBeInTheDocument()
    expect(screen.getByText('⚖️')).toBeInTheDocument()
    expect(screen.getByText('🤝')).toBeInTheDocument()
    expect(screen.getByText('🗺️')).toBeInTheDocument()
    expect(screen.getByText('💱')).toBeInTheDocument()
    expect(screen.getByText('⚙️')).toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Transactions')

    await user.click(screen.getByRole('tab', { name: 'Balances' }))

    expect(screen.getByRole('tabpanel')).toHaveTextContent('Balances')
    expect(await screen.findByRole('table', { name: 'Net balances' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Alice/ })).toBeInTheDocument()
  })

  it('removes the current group from Settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Example Italy Trip' })
    await user.click(screen.getByRole('tab', { name: 'Settings' }))
    await user.click(await screen.findByRole('button', { name: 'Delete group' }))

    expect(await screen.findByText('No groups yet.')).toBeInTheDocument()
  })

  it('switches to a selected group from the Groups button', async () => {
    await createGroup({ name: 'Weekend Dinner', defaultCurrency: 'USD', members: ['Alice', 'Bob'] })
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Weekend Dinner' })
    await user.click(screen.getByRole('button', { name: 'Choose group' }))
    await user.click(await screen.findByRole('button', { name: /Example Italy Trip/ }))

    expect(await screen.findByRole('heading', { name: 'Example Italy Trip' })).toBeInTheDocument()
  })
})
