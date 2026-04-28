import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { cropToRatio } from './crop'

// Builds a synthetic JPEG of given dimensions filled with a solid color.
// Tests use these to exercise crop math without needing a real image fixture.
async function syntheticJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .jpeg()
    .toBuffer()
}

async function dimensionsOf(bytes: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(bytes).metadata()
  if (!meta.width || !meta.height) throw new Error('no dimensions')
  return { width: meta.width, height: meta.height }
}

describe('cropToRatio', () => {
  it('returns input unchanged when source already matches target', async () => {
    const src = await syntheticJpeg(1600, 900)  // 16:9
    const out = await cropToRatio(src, '16:9')
    expect(out).toBe(src)
  })

  it('crops 16:9 source to 2.39:1 by reducing height (the P6 case)', async () => {
    const src = await syntheticJpeg(1024, 576)  // exact 16:9
    const out = await cropToRatio(src, '2.39:1')
    const dims = await dimensionsOf(out)
    expect(dims.width).toBe(1024)                         // width preserved
    expect(dims.height).toBe(Math.round(1024 / 2.39))     // ≈ 428
    expect(dims.width / dims.height).toBeCloseTo(2.39, 2)
  })

  it('crops 16:9 source to 1.85:1 by reducing height', async () => {
    const src = await syntheticJpeg(1024, 576)
    const out = await cropToRatio(src, '1.85:1')
    const dims = await dimensionsOf(out)
    expect(dims.width).toBe(1024)
    expect(dims.height).toBe(Math.round(1024 / 1.85))     // ≈ 554
  })

  it('crops 3:2 source to 1:1 by reducing width', async () => {
    const src = await syntheticJpeg(900, 600)  // 3:2 = 1.5
    const out = await cropToRatio(src, '1:1')
    const dims = await dimensionsOf(out)
    expect(dims.height).toBe(600)                         // height preserved
    expect(dims.width).toBe(600)                          // reduced to match height
  })

  it('throws on non-numeric ratio', async () => {
    const src = await syntheticJpeg(100, 100)
    await expect(cropToRatio(src, 'garbage')).rejects.toThrow(/invalid ratio/)
  })

  it('throws on zero or negative ratio', async () => {
    const src = await syntheticJpeg(100, 100)
    await expect(cropToRatio(src, '0:1')).rejects.toThrow(/invalid ratio/)
  })
})
