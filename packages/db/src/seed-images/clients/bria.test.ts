import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateStoryboard } from './bria'

describe('bria.generateStoryboard', () => {
  const ORIGINAL_TOKEN = process.env.BRIA_API_TOKEN

  beforeEach(() => {
    process.env.BRIA_API_TOKEN = 'test-token'
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env.BRIA_API_TOKEN = ORIGINAL_TOKEN
  })

  it('throws if BRIA_API_TOKEN is unset', async () => {
    delete process.env.BRIA_API_TOKEN
    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/BRIA_API_TOKEN/)
  })

  it('posts to the v2 endpoint with api_token header', async () => {
    const fakeBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) // JPEG magic
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ image_url: 'https://cdn.bria/result.jpg', structured_prompt: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeBytes.buffer,
      })
    vi.stubGlobal('fetch', fetchMock)

    const out = await generateStoryboard({ prompt: 'a pencil sketch', aspectRatio: '16:9' })

    expect(out.bytes).toBeInstanceOf(Buffer)
    expect(out.bytes.length).toBe(4)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [genUrl, genInit] = fetchMock.mock.calls[0]
    expect(genUrl).toBe('https://engine.prod.bria-api.com/v2/image/generate')
    expect(genInit.method).toBe('POST')
    expect(genInit.headers['api_token']).toBe('test-token')
    expect(genInit.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(genInit.body)
    expect(body).toEqual({ prompt: 'a pencil sketch', aspect_ratio: '16:9' })

    const [imgUrl] = fetchMock.mock.calls[1]
    expect(imgUrl).toBe('https://cdn.bria/result.jpg')
  })

  it('throws on non-ok generate response without retrying for 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false, status: 400, statusText: 'Bad Request',
      text: async () => '{"error":"prompt too long"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries up to 3 times on 5xx, then fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 503, statusText: 'Service Unavailable',
      text: async () => 'down',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/503/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  }, 15_000)

  it('retries on network error (TypeError), then succeeds', async () => {
    const fakeBytes = new Uint8Array([0xff])
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ image_url: 'https://cdn.bria/x.jpg', structured_prompt: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeBytes.buffer,
      })
    vi.stubGlobal('fetch', fetchMock)

    const out = await generateStoryboard({ prompt: 'p', aspectRatio: '16:9' })
    expect(out.bytes.length).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 fail + 1 generate ok + 1 image fetch
  })
})
