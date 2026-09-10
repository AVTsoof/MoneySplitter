import { beforeEach, describe, expect, it } from 'vitest'
import { getTheme, setTheme } from './theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
})

describe('theme preference', () => {
  it('defaults to Device with no saved preference', () => {
    expect(getTheme()).toBe('device')
  })

  it('persists Dark and adds the root class', () => {
    setTheme('dark')

    expect(localStorage.getItem('moneysplitter-theme')).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('removes explicit classes when Device is selected', () => {
    setTheme('light')
    setTheme('device')

    expect(document.documentElement).not.toHaveClass('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
