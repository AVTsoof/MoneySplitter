import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type Db = Database['public']['Tables']

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Null when no backend is configured, which is a supported mode: the app is
 * local-first and every read already comes from Dexie. Only the sync layer may
 * import this module — UI code must go through the repository.
 */
export const supabase: SupabaseClient<Database> | null =
  url && anonKey
    ? createClient<Database>(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Magic links return the session in the URL fragment.
          detectSessionInUrl: true,
        },
      })
    : null

export function isSyncConfigured(): boolean {
  return supabase !== null
}

/** Throws rather than returning null, for call sites already behind a sign-in. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  }
  return supabase
}
