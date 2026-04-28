#!/usr/bin/env tsx
// CLI: walks the manifest, fetches missing images into seed-images/files/.
// Idempotent (skip-if-exists). `--force` regenerates. `--only=<filter>` scopes.
//
// Usage:
//   pnpm --filter @origin-one/db db:fetch-images
//   pnpm --filter @origin-one/db db:fetch-images --only=p1
//   pnpm --filter @origin-one/db db:fetch-images --only=p1.cast --force
//   pnpm --filter @origin-one/db db:fetch-images --dry-run
//   pnpm --filter @origin-one/db db:fetch-images --smoke
//   pnpm --filter @origin-one/db db:fetch-images --only=storyboard --dry-run
//   pnpm --filter @origin-one/db db:fetch-images --only=storyboard --confirm-spend

import 'dotenv/config'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import sharp from 'sharp'
import pLimit from 'p-limit'
import { MANIFEST } from '../src/seed-images/manifest'
import { tonePrimer } from '../src/seed-images/tone-primers'
import { localFilePath, type ImageEntry } from '../src/seed-images/paths'
import { parseOnly, matchesOnly } from '../src/seed-images/filter'
import { searchTopPhoto } from '../src/seed-images/clients/pexels'
import { generateImage } from '../src/seed-images/clients/openai-images'
import { generateStoryboard } from '../src/seed-images/clients/bria'
import { briaAspect } from '../src/seed-images/bria-aspect'
import { buildStoryboardPrompt } from '../src/seed-images/storyboard-prompt'
import { listStoryboardEntries, type StoryboardEntry } from '../src/seed-images/shot-entries'

const FILES_ROOT = path.resolve(__dirname, '../seed-images/files')
const CREDITS_PATH = path.resolve(__dirname, '../seed-images/CREDITS.md')

type Flags = {
  only?: string
  force: boolean
  dryRun: boolean
  smoke: boolean
  confirmSpend: boolean
  concurrency?: number
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { force: false, dryRun: false, smoke: false, confirmSpend: false }
  for (const a of argv) {
    if (a.startsWith('--only=')) flags.only = a.slice('--only='.length)
    else if (a === '--force') flags.force = true
    else if (a === '--dry-run') flags.dryRun = true
    else if (a === '--smoke') flags.smoke = true
    else if (a === '--confirm-spend') flags.confirmSpend = true
    else if (a.startsWith('--concurrency=')) flags.concurrency = Number(a.slice('--concurrency='.length))
    else if (a === '--help' || a === '-h') {
      console.log('Usage: db:fetch-images [--only=<filter>] [--force] [--dry-run] [--smoke] [--confirm-spend] [--concurrency=N]')
      process.exit(0)
    }
  }
  return flags
}

type RunStats = {
  generated: number
  fetched: number
  storyboards: number
  skipped: number
  blocked: number
  failed: number
  estimatedSpendUsd: number
}

const AI_COST_USD_PER_IMAGE = 0.04 // gpt-image-1 medium
const BRIA_COST_USD_PER_IMAGE = Number(process.env.BRIA_PRICE_PER_IMAGE_USD ?? '0.04')
const STORYBOARD_CONCURRENCY = 3

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

async function cropToRatio(bytes: Buffer, ratio: string): Promise<Buffer> {
  // Center-crop to the target ratio. Bria delivers 16:9 source; we crop the
  // top/bottom for wider ratios like 2.39:1 and 1.85:1.
  const [w, h] = ratio.split(':').map(Number)
  const targetRatio = w / h
  const img = sharp(bytes)
  const meta = await img.metadata()
  if (!meta.width || !meta.height) throw new Error('cropToRatio: source has no dimensions')

  const sourceRatio = meta.width / meta.height
  if (Math.abs(sourceRatio - targetRatio) < 0.001) {
    return bytes
  }
  if (sourceRatio < targetRatio) {
    // Crop sides (target is wider than source — unusual for our case but handled).
    const newWidth = Math.round(meta.height * targetRatio)
    const left = Math.round((meta.width - newWidth) / 2)
    return img.extract({ left, top: 0, width: newWidth, height: meta.height }).jpeg().toBuffer()
  }
  // Source wider than target — crop top/bottom.
  const newHeight = Math.round(meta.width / targetRatio)
  const top = Math.round((meta.height - newHeight) / 2)
  return img.extract({ left: 0, top, width: meta.width, height: newHeight }).jpeg().toBuffer()
}

async function fetchStoryboardEntry(entry: StoryboardEntry, flags: Flags, stats: RunStats): Promise<void> {
  const outPath = path.join(FILES_ROOT, entry.localRelativePath)
  await ensureDir(path.dirname(outPath))

  if (await fileExists(outPath) && !flags.force) {
    stats.skipped++
    return
  }

  if (flags.dryRun) {
    console.log(`  would generate: ${entry.localRelativePath}`)
    return
  }

  const prompt = buildStoryboardPrompt({
    shot: entry.shot,
    scene: entry.scene,
  })
  const aspect = briaAspect(entry.aspectRatio)

  try {
    const start = Date.now()
    const { bytes: rawBytes } = await generateStoryboard({
      prompt,
      aspectRatio: aspect.request,
    })

    let finalBytes = rawBytes
    if (aspect.cropTo) {
      finalBytes = await cropToRatio(rawBytes, aspect.cropTo)
    }

    await writeAtomic(outPath, finalBytes)
    stats.storyboards++
    stats.estimatedSpendUsd += BRIA_COST_USD_PER_IMAGE
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`  ✓ storyboard: ${entry.localRelativePath} (${elapsed}s)`)
  } catch (err) {
    stats.failed++
    console.error(`  ✗ storyboard: ${entry.localRelativePath} — ${(err as Error).message}`)
  }
}

async function smokeRun(): Promise<void> {
  console.log('smoke: one Bria call with a fixed pencil-sketch prompt...')
  const { bytes } = await generateStoryboard({
    prompt: 'A simple pencil sketch of a cup of coffee on a wooden table, loose ink lines, monochrome graphite, hand-drawn.',
    aspectRatio: '16:9',
  })
  console.log(`  ✓ ok — ${bytes.length} bytes received`)
  console.log(`  Estimated cost: $${BRIA_COST_USD_PER_IMAGE.toFixed(2)}`)
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

  if (flags.smoke) {
    await smokeRun()
    return
  }

  const filter = parseOnly(flags.only)
  const stats: RunStats = { generated: 0, fetched: 0, storyboards: 0, skipped: 0, blocked: 0, failed: 0, estimatedSpendUsd: 0 }
  await ensureDir(FILES_ROOT)

  // Existing-surface entries
  const manifestEntries = MANIFEST.filter((e) => matchesOnly(e, filter))

  // Storyboard entries (added when filter is null, surface=storyboard, or projectKey-only)
  const wantsStoryboards =
    !filter ||
    filter.surface === 'storyboard' ||
    (filter.projectKey && filter.surface === undefined)

  const storyboardEntries = wantsStoryboards
    ? listStoryboardEntries().filter(e =>
        (!filter?.projectKey || e.projectKey === filter.projectKey) &&
        (!filter?.slug || e.shot.shotNumber === filter.slug)
      )
    : []

  // Spend gate for bulk storyboard runs
  const isBulkStoryboardRun = storyboardEntries.length > 1 && !flags.dryRun
  if (isBulkStoryboardRun && !flags.confirmSpend) {
    const estUsd = (storyboardEntries.length * BRIA_COST_USD_PER_IMAGE).toFixed(2)
    console.error(`Refusing to run: ${storyboardEntries.length} storyboard generations would cost ~$${estUsd}.`)
    console.error(`Re-run with --confirm-spend to proceed, or scope with --only=p1.storyboard.<shotNumber> for single shots.`)
    process.exit(2)
  }

  console.log(
    `fetch-seed-images: ${manifestEntries.length} manifest + ${storyboardEntries.length} storyboards` +
    `${filter ? ` (filter: ${flags.only})` : ''}` +
    `${flags.force ? ' [force]' : ''}${flags.dryRun ? ' [dry-run]' : ''}`
  )

  // Manifest entries — sequential as before
  for (const entry of manifestEntries) {
    await fetchEntry(entry, flags, stats)
  }

  // Storyboard entries — bounded concurrency
  const limit = pLimit(flags.concurrency ?? STORYBOARD_CONCURRENCY)
  await Promise.all(
    storyboardEntries.map(e => limit(() => fetchStoryboardEntry(e, flags, stats)))
  )

  if (!flags.dryRun) {
    await writeCredits()
  }

  console.log('')
  console.log('  Summary:')
  console.log(`    generated (ai):    ${stats.generated}`)
  console.log(`    fetched (stock):   ${stats.fetched}`)
  console.log(`    storyboards:       ${stats.storyboards}`)
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
