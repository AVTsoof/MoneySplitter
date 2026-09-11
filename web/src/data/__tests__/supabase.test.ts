import { afterEach, describe, expect, it, vi } from 'vitest'

/** Re-imports the module so the env is read fresh for each case. */
async function loadWithEnv(url?: string, anonKey?: string) {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', url ?? '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', anonKey ?? '')
  return import('../supabase')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('supabase client', () => {
  it('is absent when the env is unset, so the app stays local-only', async () => {
    const { supabase, isSyncConfigured } = await loadWithEnv()
    expect(supabase).toBeNull()
    expect(isSyncConfigured()).toBe(false)
  })

  it('is created when both env values are present', async () => {
    const { supabase, isSyncConfigured } = await loadWithEnv(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
    )
    expect(supabase).not.toBeNull()
    expect(isSyncConfigured()).toBe(true)
  })

  it('requireSupabase throws instead of returning null', async () => {
    const { requireSupabase } = await loadWithEnv()
    expect(() => requireSupabase()).toThrow(/not configured/)
  })
})
