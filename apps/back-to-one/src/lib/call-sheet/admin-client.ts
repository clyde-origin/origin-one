// Admin Supabase client for server-side call-sheet dispatch (cron + send routes).
//
// Prefers SUPABASE_SERVICE_ROLE_KEY for production (bypasses RLS regardless
// of policy state). Falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY when service
// role is unset — this works pre-Auth-day because the call-sheet tables are
// permissive/no-RLS (matches the existing storage discipline pattern). When
// the #24 RLS pass tightens these tables, the anon fallback will start
// failing and the server will require the service role key.

import { createClient } from '@supabase/supabase-js'

export function getCallSheetAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL env var.')
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const key = serviceKey || anonKey
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }
  if (!serviceKey && process.env.NODE_ENV === 'production') {
    console.warn('[call-sheet] Using anon key for server-side writes — set SUPABASE_SERVICE_ROLE_KEY for production.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
