// Admin Supabase client for server-side call-sheet dispatch (cron + send routes).
// Bypasses RLS — gated by route auth (Vercel cron secret + per-project edit check).

import { createClient } from '@supabase/supabase-js'

export function getCallSheetAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
