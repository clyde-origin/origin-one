// Supabase Storage helpers used by prisma/seed.ts. Service-role client
// (bypasses RLS) — required because seed runs server-side and needs to clear
// + populate buckets that may be locked down post-Auth.

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Bucket } from './paths'

let _client: SupabaseClient | null = null
function client(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Seed needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in packages/db/.env.')
  }
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

export const FILES_ROOT = path.resolve(__dirname, '../../seed-images/files')

export async function uploadSeedImage(args: {
  localRelativePath: string  // e.g. 'p1/location/bel-air-estate.jpg'
  bucket: Bucket
  storagePath: string         // e.g. 'location/<rowId>/bel-air-estate.jpg'
}): Promise<string> {
  const local = path.join(FILES_ROOT, args.localRelativePath)
  const bytes = await fs.readFile(local).catch(() => {
    throw new Error(
      `Seed image missing on disk: ${args.localRelativePath}. ` +
      `Run \`pnpm --filter @origin-one/db db:fetch-images\` first, ` +
      `or check the manifest entry.`,
    )
  })

  // Retry up to 3 times with 2-second back-off for transient gateway errors.
  let lastError: string = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error } = await client()
      .storage
      .from(args.bucket)
      .upload(args.storagePath, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      })
    if (!error) return args.storagePath
    lastError = error.message
    const isTransient = /gateway|timeout|network|503|502/i.test(error.message)
    if (!isTransient || attempt === 3) break
    await new Promise(r => setTimeout(r, 2000 * attempt))
  }
  throw new Error(`Storage upload failed (${args.bucket}/${args.storagePath}): ${lastError}`)
}

// Wipes all objects in a bucket so seeding starts from a clean slate.
// Mirrors the truncate-and-reseed pattern of the DB.
export async function clearBucket(bucket: Bucket): Promise<void> {
  const c = client()
  // List then delete in batches of 100 (Supabase limit).
  let page = 0
  while (true) {
    const { data, error } = await c.storage.from(bucket).list('', {
      limit: 1000,
      offset: page * 1000,
    })
    if (error) throw new Error(`list ${bucket} failed: ${error.message}`)
    if (!data || data.length === 0) break

    // Recursively gather every file path under each top-level entry.
    const allPaths: string[] = []
    for (const entry of data) {
      if (entry.name) {
        await collectPaths(c, bucket, entry.name, allPaths)
      }
    }
    if (allPaths.length === 0) break
    const { error: rmErr } = await c.storage.from(bucket).remove(allPaths)
    if (rmErr) throw new Error(`remove ${bucket} failed: ${rmErr.message}`)
    if (data.length < 1000) break
    page++
  }
}

async function collectPaths(
  c: SupabaseClient,
  bucket: Bucket,
  prefix: string,
  acc: string[],
): Promise<void> {
  const { data } = await c.storage.from(bucket).list(prefix, { limit: 1000 })
  if (!data) return
  for (const e of data) {
    const full = `${prefix}/${e.name}`
    // Folder entries have no metadata; recurse. File entries have metadata.
    if (e.metadata) acc.push(full)
    else await collectPaths(c, bucket, full, acc)
  }
}
