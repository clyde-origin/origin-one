// Bria.ai text-to-image client. Pure: no Prisma, no Supabase, no filesystem.
// Importable from both the seed-side fetch CLI and (in a future arc) an
// in-app server route.
//
// Quirks vs OpenAI:
//   - Auth header is literal `api_token: <value>`, not Authorization Bearer.
//   - /v2/image/generate is ASYNC: returns { request_id, status_url }.
//   - Caller must poll status_url until status === 'COMPLETED' or 'FAILED'.
//   - Only then does the response contain result.image_url to fetch bytes from.
//
// Docs: https://docs.bria.ai/

import type { BriaRequestRatio } from '../bria-aspect'

const BRIA_GENERATE_URL = 'https://engine.prod.bria-api.com/v2/image/generate'

// Both are env-overridable so tests can shrink them without real timer tricks.
// Read at call time (not module load time) so process.env changes in tests take effect.
function getPollIntervalMs() { return Number(process.env.BRIA_POLL_INTERVAL_MS ?? 1_500) }
function getPollTimeoutMs() { return Number(process.env.BRIA_POLL_TIMEOUT_MS ?? 60_000) }

export type GenerateStoryboardArgs = {
  prompt: string
  aspectRatio: BriaRequestRatio
}

export type GenerateStoryboardResult = {
  bytes: Buffer
}

const MAX_ATTEMPTS = 3
// Read at call time so tests can override via process.env.BRIA_BACKOFF_MS
function getBackoffMs() { return Number(process.env.BRIA_BACKOFF_MS ?? 2_000) }

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600)
}

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

type GenerateResponse = {
  request_id: string
  status_url: string
}

type StatusResponse = {
  status: string
  request_id: string
  result?: {
    image_url?: string
    warning?: string | null
    structured_prompt?: string
    seed?: number
  }
}

async function generateAndFetch(token: string, args: GenerateStoryboardArgs): Promise<GenerateStoryboardResult> {
  // --- Hop 1: POST to /image/generate ---
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
    // Signal transient so the retry wrapper can catch it
    throw Object.assign(err, { transient: true })
  }

  const genData = await genRes.json() as GenerateResponse
  const { status_url } = genData

  // --- Hop 2: Poll status_url ---
  const pollTimeoutMs = getPollTimeoutMs()
  const deadline = Date.now() + pollTimeoutMs
  while (Date.now() < deadline) {
    const pollRes = await fetch(status_url, {
      headers: { 'api_token': token },
    })

    if (!pollRes.ok) {
      const text = await pollRes.text().catch(() => '')
      const err = new Error(`Bria status poll failed: ${pollRes.status} ${pollRes.statusText} ${text.slice(0, 200)}`)
      if (!isTransientStatus(pollRes.status)) throw err
      // Transient poll failure: restart entire flow per spec
      throw Object.assign(err, { transient: true })
    }

    const pollData = await pollRes.json() as StatusResponse

    if (pollData.status === 'COMPLETED') {
      const imageUrl = pollData.result?.image_url
      if (!imageUrl) {
        throw new Error(`Bria COMPLETED but result.image_url missing: ${JSON.stringify(pollData).slice(0, 200)}`)
      }

      // --- Hop 3: Fetch image bytes ---
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) {
        const err = new Error(`Bria image fetch failed: ${imgRes.status} ${imgRes.statusText}`)
        if (!isTransientStatus(imgRes.status)) throw err
        throw Object.assign(err, { transient: true })
      }

      const ab = await imgRes.arrayBuffer()
      return { bytes: Buffer.from(ab) }
    }

    if (pollData.status === 'FAILED') {
      throw new Error(`Bria generation FAILED for request ${pollData.request_id}`)
    }

    // IN_PROGRESS, PENDING, or anything else — keep polling
    await sleep(getPollIntervalMs())
  }

  throw new Error(`Bria polling timed out after ${pollTimeoutMs}ms`)
}

export async function generateStoryboard(args: GenerateStoryboardArgs): Promise<GenerateStoryboardResult> {
  const token = process.env.BRIA_API_TOKEN
  if (!token) {
    throw new Error('BRIA_API_TOKEN not set. Add it to packages/db/.env.')
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await generateAndFetch(token, args)
    } catch (err) {
      // Network / DNS / fetch-level errors arrive as TypeError.
      // Errors explicitly marked transient are also retry-eligible.
      const isNetworkError = err instanceof TypeError
      const isTaggedTransient = (err as { transient?: boolean }).transient === true
      if (isNetworkError || isTaggedTransient) {
        lastError = err as Error
      } else {
        throw err
      }
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(getBackoffMs() * attempt)
    }
  }
  throw lastError ?? new Error('Bria generate failed after retries')
}
