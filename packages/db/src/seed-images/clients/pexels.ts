// Thin wrapper over the Pexels search endpoint. Returns the top result's
// bytes plus attribution metadata (Pexels recommends but does not strictly
// require attribution; we record it anyway for CREDITS.md aggregation).
//
// API docs: https://www.pexels.com/api/documentation/

export type PexelsResult = {
  bytes: Buffer
  attribution: {
    photographer: string
    photographerUrl: string
    sourceUrl: string
    photoId: string
  }
}

const PEXELS_SEARCH = 'https://api.pexels.com/v1/search'

export async function searchTopPhoto(query: string): Promise<PexelsResult> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY not set. Add it to packages/db/.env.')
  }

  const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&size=large`
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  })
  if (!res.ok) {
    throw new Error(`Pexels search failed: ${res.status} ${res.statusText} for "${query}"`)
  }
  const data = (await res.json()) as {
    photos: Array<{
      id: number
      url: string
      photographer: string
      photographer_url: string
      src: { original: string; large2x: string; large: string; medium: string }
    }>
  }
  if (!data.photos.length) {
    throw new Error(`Pexels returned 0 results for "${query}"`)
  }
  const top = data.photos[0]

  // Pexels delivers via its CDN. `large` is ~940px wide; `large2x` is ~1880px.
  // For seed images we want roughly 1600px landscape, so `large2x` is the right
  // ask. No download-tracking endpoint to ping (unlike Unsplash).
  const imgRes = await fetch(top.src.large2x)
  if (!imgRes.ok) {
    throw new Error(`Pexels image fetch failed: ${imgRes.status} for "${query}"`)
  }
  const arrayBuf = await imgRes.arrayBuffer()

  return {
    bytes: Buffer.from(arrayBuf),
    attribution: {
      photographer: top.photographer,
      photographerUrl: top.photographer_url,
      sourceUrl: top.url,
      photoId: String(top.id),
    },
  }
}
