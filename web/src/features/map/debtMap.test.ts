import { expect, it } from 'vitest'
import { Decimal } from '../../core/money'
import { buildDebtMap, buildDefaultCurrencyDebtMap } from './debtMap'

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

it('labels converted map edges in the group default currency', () => {
  const members = [
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
  ]
  const map = buildDefaultCurrencyDebtMap(
    members,
    { USD: { Alice: new Decimal('5'), Bob: new Decimal('-5') } },
    'EUR',
    { USD: '1.08' },
  )

  expect(map.edges).toEqual([
    expect.objectContaining({ source: 'Bob', target: 'Alice', label: '4.63 EUR' }),
  ])
})
