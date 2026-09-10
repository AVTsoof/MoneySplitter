import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDatabase } from '../../data/db'
import { createGroup, updateGroup } from '../../data/repository'
import { RatesTab } from './RatesTab'

beforeEach(async () => {
  await resetDatabase()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RatesTab', () => {
  it('displays a conversion matrix for only the group active currencies', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ rates: { USD: 1.08 } }), { status: 200 }),
    )
    const user = userEvent.setup()
    const groupId = await createGroup({
      name: 'Trip',
      defaultCurrency: 'EUR',
      members: ['Alice'],
    })
    await updateGroup(groupId, { activeCurrencies: ['EUR', 'USD'] })
    render(<RatesTab groupId={groupId} />)

    await user.click(await screen.findByRole('button', { name: 'Refresh rates' }))

    const matrix = await screen.findByRole('table', { name: 'Currency conversion matrix' })
    expect(matrix).toHaveTextContent('EUR')
    expect(matrix).toHaveTextContent('USD')
    expect(matrix).toHaveTextContent('1.000000')
    expect(matrix).toHaveTextContent('1.080000')
    expect(matrix).toHaveTextContent('0.925926')
  })
})
