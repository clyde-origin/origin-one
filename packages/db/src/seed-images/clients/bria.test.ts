import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateStoryboard } from './bria'

// Helpers to build mock fetch responses
function makeJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

function makeBytesResponse(bytes: Uint8Array) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
  }
}

const STATUS_URL = 'https://engine.prod.bria-api.com/v2/status/abc123'
const IMAGE_URL = 'https://d1ei2xrl63k822.cloudfront.net/api/res/result.png'

const GEN_RESPONSE = { request_id: 'abc123', status_url: STATUS_URL }
const IN_PROGRESS_RESPONSE = { status: 'IN_PROGRESS', request_id: 'abc123' }
const COMPLETED_RESPONSE = {
  status: 'COMPLETED',
  request_id: 'abc123',
  result: { image_url: IMAGE_URL, seed: 12345, warning: null },
}
const FAILED_RESPONSE = { status: 'FAILED', request_id: 'abc123' }

const FAKE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

describe('bria.generateStoryboard', () => {
  const ORIGINAL_TOKEN = process.env.BRIA_API_TOKEN
  const ORIGINAL_POLL_TIMEOUT = process.env.BRIA_POLL_TIMEOUT_MS
  const ORIGINAL_POLL_INTERVAL = process.env.BRIA_POLL_INTERVAL_MS
  const ORIGINAL_BACKOFF = process.env.BRIA_BACKOFF_MS

  beforeEach(() => {
    process.env.BRIA_API_TOKEN = 'test-token'
    // Zero out all delays by default so tests don't wait
    process.env.BRIA_POLL_INTERVAL_MS = '0'
    process.env.BRIA_BACKOFF_MS = '0'
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env.BRIA_API_TOKEN = ORIGINAL_TOKEN
    if (ORIGINAL_POLL_TIMEOUT === undefined) delete process.env.BRIA_POLL_TIMEOUT_MS
    else process.env.BRIA_POLL_TIMEOUT_MS = ORIGINAL_POLL_TIMEOUT
    if (ORIGINAL_POLL_INTERVAL === undefined) delete process.env.BRIA_POLL_INTERVAL_MS
    else process.env.BRIA_POLL_INTERVAL_MS = ORIGINAL_POLL_INTERVAL
    if (ORIGINAL_BACKOFF === undefined) delete process.env.BRIA_BACKOFF_MS
    else process.env.BRIA_BACKOFF_MS = ORIGINAL_BACKOFF
  })

  // ------------------------------------------------------------------ token
  it('throws if BRIA_API_TOKEN is unset', async () => {
    delete process.env.BRIA_API_TOKEN
    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/BRIA_API_TOKEN/)
  })

  // ------------------------------------------------------------------ happy path
  it('happy path: POST → IN_PROGRESS → COMPLETED → image bytes (4 fetches)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeJsonResponse(GEN_RESPONSE))          // 1: POST /image/generate
      .mockResolvedValueOnce(makeJsonResponse(IN_PROGRESS_RESPONSE))  // 2: poll → IN_PROGRESS
      .mockResolvedValueOnce(makeJsonResponse(COMPLETED_RESPONSE))    // 3: poll → COMPLETED
      .mockResolvedValueOnce(makeBytesResponse(FAKE_BYTES))           // 4: fetch image bytes
    vi.stubGlobal('fetch', fetchMock)

    const out = await generateStoryboard({ prompt: 'a pencil sketch', aspectRatio: '16:9' })

    expect(out.bytes).toBeInstanceOf(Buffer)
    expect(out.bytes.length).toBe(4)
    expect(fetchMock).toHaveBeenCalledTimes(4)

    // Verify POST call
    const [genUrl, genInit] = fetchMock.mock.calls[0]
    expect(genUrl).toBe('https://engine.prod.bria-api.com/v2/image/generate')
    expect(genInit.method).toBe('POST')
    expect(genInit.headers['api_token']).toBe('test-token')
    expect(genInit.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(genInit.body)).toEqual({ prompt: 'a pencil sketch', aspect_ratio: '16:9' })

    // Verify both poll calls carry api_token header
    const [pollUrl1, pollInit1] = fetchMock.mock.calls[1]
    expect(pollUrl1).toBe(STATUS_URL)
    expect(pollInit1.headers['api_token']).toBe('test-token')

    const [pollUrl2, pollInit2] = fetchMock.mock.calls[2]
    expect(pollUrl2).toBe(STATUS_URL)
    expect(pollInit2.headers['api_token']).toBe('test-token')

    // Verify image fetch URL
    const [imgUrl] = fetchMock.mock.calls[3]
    expect(imgUrl).toBe(IMAGE_URL)
  })

  // ------------------------------------------------------------------ POST 4xx
  it('POST 4xx: no retry, throws with status code', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false, status: 400, statusText: 'Bad Request',
      json: async () => ({ error: 'prompt too long' }),
      text: async () => '{"error":"prompt too long"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // ------------------------------------------------------------------ POST 5xx
  it('POST 5xx: retries up to 3 times, then fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 503, statusText: 'Service Unavailable',
      json: async () => ({}),
      text: async () => 'down',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/503/)
    // 3 POST attempts, each fails immediately (no poll reached)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  }, 15_000)

  // ------------------------------------------------------------------ status FAILED
  it('status FAILED: throws descriptive error, no retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeJsonResponse(GEN_RESPONSE))     // POST ok
      .mockResolvedValueOnce(makeJsonResponse(FAILED_RESPONSE))  // poll → FAILED
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/FAILED/)
    // Only 2 fetches: POST + one poll. No retry because FAILED is definitive.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  // ------------------------------------------------------------------ timeout
  it('status timeout: throws timeout error when IN_PROGRESS never resolves', async () => {
    // Shrink the timeout to near-zero so the loop exits after the first poll
    process.env.BRIA_POLL_TIMEOUT_MS = '1'
    process.env.BRIA_POLL_INTERVAL_MS = '0'

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeJsonResponse(GEN_RESPONSE))          // POST ok
      .mockResolvedValue(makeJsonResponse(IN_PROGRESS_RESPONSE))      // every poll → IN_PROGRESS

    vi.stubGlobal('fetch', fetchMock)

    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/timed out/)
  })

  // ------------------------------------------------------------------ network error on POST
  it('network error on POST (TypeError): retries, eventually succeeds', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))       // attempt 1: network error
      .mockResolvedValueOnce(makeJsonResponse(GEN_RESPONSE))      // attempt 2: POST ok
      .mockResolvedValueOnce(makeJsonResponse(COMPLETED_RESPONSE)) // attempt 2: poll → COMPLETED
      .mockResolvedValueOnce(makeBytesResponse(FAKE_BYTES))        // attempt 2: image bytes
    vi.stubGlobal('fetch', fetchMock)

    const out = await generateStoryboard({ prompt: 'p', aspectRatio: '16:9' })
    expect(out.bytes.length).toBe(4)
    // 1 network error + 1 POST + 1 poll + 1 image fetch = 4
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
