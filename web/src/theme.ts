export type Theme = 'light' | 'dark' | 'device'

const storageKey = 'moneysplitter-theme'

export function getTheme(): Theme {
  const saved = localStorage.getItem(storageKey)
  return saved === 'light' || saved === 'dark' || saved === 'device' ? saved : 'device'
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(storageKey, theme)
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
