import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDatabase } from '../../data/db'
import { createGroup } from '../../data/repository'
import { RatesTab } from './RatesTab'

beforeEach(async () => {
  await resetDatabase()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RatesTab', () => {
  it('loads and displays rates for the group default currency', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ rates: { USD: 1.08 } }), { status: 200 }),
    )
    const user = userEvent.setup()
    const groupId = await createGroup({
      name: 'Trip',
      defaultCurrency: 'EUR',
      members: ['Alice'],
    })
    render(<RatesTab groupId={groupId} />)

    await user.click(await screen.findByRole('button', { name: 'Refresh rates' }))

    expect(await screen.findByText('1 EUR = 1.08 USD')).toBeInTheDocument()
  })
})
