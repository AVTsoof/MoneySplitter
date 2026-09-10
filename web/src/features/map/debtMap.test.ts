import { expect, it } from 'vitest'
import { buildDebtMap } from './debtMap'

it('maps simplified settlements to named debtor-to-creditor edges', () => {
  const map = buildDebtMap(['Alice', 'Bob'], {
    EUR: [{ from: 'Bob', to: 'Alice', amount: '15.00' }],
  })

  expect(map.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'Alice', data: { label: 'Alice' } }),
      expect.objectContaining({ id: 'Bob', data: { label: 'Bob' } }),
    ]),
  )
  expect(map.edges).toEqual([
    expect.objectContaining({ source: 'Bob', target: 'Alice', label: '15.00 EUR' }),
  ])
})
