#!/usr/bin/env tsx
// CLI: walks the manifest, fetches missing images into seed-images/files/.
// Idempotent (skip-if-exists). `--force` regenerates. `--only=<filter>` scopes.
//
// Usage:
//   pnpm --filter @origin-one/db db:fetch-images
//   pnpm --filter @origin-one/db db:fetch-images --only=p1
//   pnpm --filter @origin-one/db db:fetch-images --only=p1.cast --force
//   pnpm --filter @origin-one/db db:fetch-images --dry-run

import 'dotenv/config'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { MANIFEST } from '../src/seed-images/manifest'
import { tonePrimer } from '../src/seed-images/tone-primers'
import { localFilePath, type ImageEntry } from '../src/seed-images/paths'
import { parseOnly, matchesOnly } from '../src/seed-images/filter'
import { searchTopPhoto } from '../src/seed-images/clients/pexels'
import { generateImage } from '../src/seed-images/clients/openai-images'

const FILES_ROOT = path.resolve(__dirname, '../seed-images/files')
const CREDITS_PATH = path.resolve(__dirname, '../seed-images/CREDITS.md')

type Flags = { only?: string; force: boolean; dryRun: boolean }
function parseArgs(argv: string[]): Flags {
  const flags: Flags = { force: false, dryRun: false }
  for (const a of argv) {
    if (a.startsWith('--only=')) flags.only = a.slice('--only='.length)
    else if (a === '--force') flags.force = true
    else if (a === '--dry-run') flags.dryRun = true
    else if (a === '--help' || a === '-h') {
      console.log('Usage: db:fetch-images [--only=<filter>] [--force] [--dry-run]')
      process.exit(0)
    }
  }
  return flags
}

type RunStats = {
  generated: number
  fetched: number
  skipped: number
  blocked: number
  failed: number
  estimatedSpendUsd: number
}

const AI_COST_USD_PER_IMAGE = 0.04 // gpt-image-1 medium

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true })
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function writeAtomic(targetPath: string, bytes: Buffer): Promise<void> {
  const tmp = `${targetPath}.tmp`
  await fs.writeFile(tmp, bytes)
  await fs.rename(tmp, targetPath)
}

type Sidecar = {
  source: 'pexels'
  photographer: string
  photographerUrl: string
  sourceUrl: string
  photoId: string
}

async function fetchEntry(entry: ImageEntry, flags: Flags, stats: RunStats): Promise<void> {
  const outPath = path.join(FILES_ROOT, localFilePath(entry))
  await ensureDir(path.dirname(outPath))

  const exists = await fileExists(outPath)
  if (exists && !flags.force) {
    stats.skipped++
    return
  }

  if (flags.dryRun) {
    console.log(`  would fetch: ${localFilePath(entry)} (${entry.source})`)
    return
  }

  try {
    if (entry.source === 'stock') {
      if (!entry.query) throw new Error(`stock entry ${entry.slug} missing query`)
      const { bytes, attribution } = await searchTopPhoto(entry.query)
      await writeAtomic(outPath, bytes)
      const sidecar: Sidecar = { source: 'pexels', ...attribution }
      await fs.writeFile(outPath.replace(/\.jpg$/, '.json'), JSON.stringify(sidecar, null, 2))
      stats.fetched++
      console.log(`  ✓ stock: ${localFilePath(entry)}`)
    } else {
      if (!entry.prompt) throw new Error(`ai entry ${entry.slug} missing prompt`)
      const finalPrompt = `${tonePrimer(entry.projectKey)}\n\n${entry.prompt}`
      const { bytes } = await generateImage({ prompt: finalPrompt, surface: entry.surface })
      await writeAtomic(outPath, bytes)
      stats.generated++
      stats.estimatedSpendUsd += AI_COST_USD_PER_IMAGE
      console.log(`  ✓ ai:    ${localFilePath(entry)}`)
    }
  } catch (err) {
    const msg = (err as Error).message
    if (/safety|moderation|content policy/i.test(msg)) {
      await fs.writeFile(`${outPath}.BLOCKED`, msg)
      stats.blocked++
      console.warn(`  ✗ blocked: ${localFilePath(entry)} — ${msg}`)
    } else {
      stats.failed++
      console.error(`  ✗ failed: ${localFilePath(entry)} — ${msg}`)
    }
  }
}

async function writeCredits(): Promise<void> {
  const sidecars: Array<Sidecar & { file: string }> = []
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile() && e.name.endsWith('.json')) {
        try {
          const data = JSON.parse(await fs.readFile(full, 'utf8')) as Sidecar
          if (data.source === 'pexels') {
            sidecars.push({ ...data, file: path.relative(FILES_ROOT, full).replace(/\.json$/, '.jpg') })
          }
        } catch { /* skip malformed sidecars */ }
      }
    }
  }
  await walk(FILES_ROOT).catch(() => { /* tree may not exist on dry runs */ })

  const lines: string[] = [
    '# Seed image credits',
    '',
    'Stock images sourced from Pexels. Attribution recorded per the Pexels API guidelines.',
    '',
    '| File | Photographer | Source |',
    '| --- | --- | --- |',
  ]
  for (const s of sidecars.sort((a, b) => a.file.localeCompare(b.file))) {
    lines.push(`| \`${s.file}\` | [${s.photographer}](${s.photographerUrl}) | [Pexels](${s.sourceUrl}) |`)
  }
  await fs.writeFile(CREDITS_PATH, lines.join('\n') + '\n')
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))
  const filter = parseOnly(flags.only)
  const stats: RunStats = { generated: 0, fetched: 0, skipped: 0, blocked: 0, failed: 0, estimatedSpendUsd: 0 }

  await ensureDir(FILES_ROOT)

  const entries = MANIFEST.filter((e) => matchesOnly(e, filter))
  console.log(`fetch-seed-images: ${entries.length} entries${filter ? ` (filter: ${flags.only})` : ''}${flags.force ? ' [force]' : ''}${flags.dryRun ? ' [dry-run]' : ''}`)

  // Sequential to keep API calls polite. Two-at-a-time concurrency is a future
  // optimization; given ~180 entries and this script runs rarely, sequential
  // is plenty fast.
  for (const entry of entries) {
    await fetchEntry(entry, flags, stats)
  }

  if (!flags.dryRun) {
    await writeCredits()
  }

  console.log('')
  console.log('  Summary:')
  console.log(`    generated (ai):    ${stats.generated}`)
  console.log(`    fetched (stock):   ${stats.fetched}`)
  console.log(`    skipped (cached):  ${stats.skipped}`)
  console.log(`    blocked:           ${stats.blocked}`)
  console.log(`    failed:            ${stats.failed}`)
  console.log(`    estimated spend:   $${stats.estimatedSpendUsd.toFixed(2)}`)

  process.exit(stats.failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
