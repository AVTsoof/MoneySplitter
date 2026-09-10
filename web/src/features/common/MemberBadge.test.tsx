import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemberBadge } from './MemberBadge'

describe('MemberBadge', () => {
  it('renders the member name with its stored color', () => {
    render(
      <MemberBadge
        member={{
          id: 'member-1',
          groupId: 'group-1',
          displayName: 'Alice',
          color: '#2563eb',
          userId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
      />,
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByLabelText('Alice color')).toHaveStyle({
      backgroundColor: 'rgb(37, 99, 235)',
    })
  })
})
