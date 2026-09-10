import { expect, it } from 'vitest'
import { buildDebtMap } from './debtMap'

it('maps simplified settlements to named debtor-to-creditor edges', () => {
  const map = buildDebtMap(
    [
      {
        id: 'alice',
        groupId: 'group',
        displayName: 'Alice',
        color: '#2563eb',
        userId: null,
        createdAt: 'x',
        updatedAt: 'x',
      },
      {
        id: 'bob',
        groupId: 'group',
        displayName: 'Bob',
        color: '#7c3aed',
        userId: null,
        createdAt: 'x',
        updatedAt: 'x',
      },
    ],
    {
      EUR: [{ from: 'Bob', to: 'Alice', amount: '15.00' }],
    },
  )

  expect(map.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'Alice',
        data: { label: 'Alice' },
        style: { borderColor: '#2563eb' },
      }),
      expect.objectContaining({ id: 'Bob', data: { label: 'Bob' } }),
    ]),
  )
  expect(map.edges).toEqual([
    expect.objectContaining({ source: 'Bob', target: 'Alice', label: '15.00 EUR' }),
  ])
})
