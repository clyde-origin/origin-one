// Bria.ai text-to-image client. Pure: no Prisma, no Supabase, no filesystem.
// Importable from both the seed-side fetch CLI and (in a future arc) an
// in-app server route.
//
// Quirks vs OpenAI:
//   - Auth header is literal `api_token: <value>`, not Authorization Bearer.
//   - Response is { image_url }, not base64. Caller's hop is generate → fetch URL.
//
// Docs: https://docs.bria.ai/

import type { BriaRequestRatio } from '../bria-aspect'

const BRIA_GENERATE_URL = 'https://engine.prod.bria-api.com/v2/image/generate'

export type GenerateStoryboardArgs = {
  prompt: string
  aspectRatio: BriaRequestRatio
}

export type GenerateStoryboardResult = {
  bytes: Buffer
}

const MAX_ATTEMPTS = 3
const BACKOFF_MS = 2_000

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600)
}

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

export async function generateStoryboard(args: GenerateStoryboardArgs): Promise<GenerateStoryboardResult> {
  const token = process.env.BRIA_API_TOKEN
  if (!token) {
    throw new Error('BRIA_API_TOKEN not set. Add it to packages/db/.env.')
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const genRes = await fetch(BRIA_GENERATE_URL, {
        method: 'POST',
        headers: {
          'api_token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: args.prompt,
          aspect_ratio: args.aspectRatio,
        }),
      })
      if (!genRes.ok) {
        const text = await genRes.text().catch(() => '')
        const err = new Error(`Bria generate failed: ${genRes.status} ${genRes.statusText} ${text.slice(0, 200)}`)
        if (!isTransientStatus(genRes.status)) throw err
        lastError = err
      } else {
        const data = await genRes.json() as { image_url?: string }
        if (!data.image_url) {
          throw new Error(`Bria response missing image_url: ${JSON.stringify(data).slice(0, 200)}`)
        }
        const imgRes = await fetch(data.image_url)
        if (!imgRes.ok) {
          const err = new Error(`Bria image fetch failed: ${imgRes.status} ${imgRes.statusText}`)
          if (!isTransientStatus(imgRes.status)) throw err
          lastError = err
        } else {
          const ab = await imgRes.arrayBuffer()
          return { bytes: Buffer.from(ab) }
        }
      }
    } catch (err) {
      // Network / DNS / fetch-level errors arrive as TypeError. Treat as transient.
      if (err instanceof TypeError) {
        lastError = err
      } else {
        throw err
      }
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BACKOFF_MS * attempt)
    }
  }
  throw lastError ?? new Error('Bria generate failed after retries')
}
