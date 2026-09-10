import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDatabase } from './data/db'
import App from './App'

beforeEach(async () => {
  await resetDatabase()
})

describe('App', () => {
  it('seeds the example group and switches between workspace tabs', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Example Italy Trip' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
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
})
