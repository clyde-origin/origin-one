/**
 * Create the `moodboard` storage bucket in Supabase.
 *
 * Run:  node apps/back-to-one/scripts/setup-storage.mjs
 *
 * Uses the anon key from .env.local. Safe to run multiple times.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or key in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  // 1. Create bucket
  const { data, error } = await supabase.storage.createBucket('moodboard', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    fileSizeLimit: 10485760, // 10 MB
  })

  if (error) {
    if (error.message?.includes('already exists')) {
      console.log('✓ Bucket "moodboard" already exists')
    } else {
      console.error('✗ Failed to create bucket:', error.message)
      console.error('  (If using anon key, you may need to create the bucket via Supabase dashboard)')
      process.exit(1)
    }
  } else {
    console.log('✓ Created bucket "moodboard"')
  }

  // 2. Verify bucket is accessible
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
  if (listErr) {
    console.error('✗ Could not list buckets:', listErr.message)
  } else {
    const mb = buckets.find(b => b.name === 'moodboard')
    if (mb) {
      console.log(`✓ Bucket confirmed — public: ${mb.public}, file_size_limit: ${mb.file_size_limit}`)
    }
  }

  console.log('\nDone. Moodboard storage is ready.')
}

main()
