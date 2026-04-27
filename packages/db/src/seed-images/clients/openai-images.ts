// Thin wrapper over OpenAI's image generation endpoint. Returns raw bytes.
// Uses gpt-image-1 (top general model as of cutoff). Quality 'medium' is the
// default — operators can bump to 'high' on a per-entry basis later by editing
// the manifest if they add a `quality` field.

import OpenAI from 'openai'
import type { Surface } from '../paths'
import { imageSizeForSurface } from '../paths'

export type OpenAIImageResult = {
  bytes: Buffer
}

let _client: OpenAI | null = null
function client(): OpenAI {
  if (_client) return _client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set. Add it to packages/db/.env.')
  }
  _client = new OpenAI({ apiKey })
  return _client
}

export async function generateImage(args: {
  prompt: string
  surface: Surface
}): Promise<OpenAIImageResult> {
  const size = imageSizeForSurface(args.surface)
  const res = await client().images.generate({
    model: 'gpt-image-1',
    prompt: args.prompt,
    size,
    quality: 'medium',
    n: 1,
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) {
    throw new Error(`OpenAI returned no image data for prompt: ${args.prompt.slice(0, 80)}…`)
  }
  return { bytes: Buffer.from(b64, 'base64') }
}
