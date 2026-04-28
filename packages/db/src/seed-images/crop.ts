// Center-crop a JPEG buffer to a target aspect ratio. Used by the storyboard
// fetcher to take a 16:9 Bria-generated image and crop to non-native ratios
// like 2.39:1 or 1.85:1. Pure: input bytes → output bytes.

import sharp from 'sharp'

export async function cropToRatio(bytes: Buffer, ratio: string): Promise<Buffer> {
  const [w, h] = ratio.split(':').map(Number)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`cropToRatio: invalid ratio "${ratio}"`)
  }
  const targetRatio = w / h
  const img = sharp(bytes)
  const meta = await img.metadata()
  if (!meta.width || !meta.height) {
    throw new Error('cropToRatio: source has no dimensions')
  }

  const sourceRatio = meta.width / meta.height
  if (Math.abs(sourceRatio - targetRatio) < 0.001) {
    return bytes
  }

  if (targetRatio > sourceRatio) {
    // Target is wider — reduce height (crop top+bottom).
    const newHeight = Math.round(meta.width / targetRatio)
    const top = Math.round((meta.height - newHeight) / 2)
    return img.extract({ left: 0, top, width: meta.width, height: newHeight }).jpeg().toBuffer()
  }
  // Target is narrower — reduce width (crop sides).
  const newWidth = Math.round(meta.height * targetRatio)
  const left = Math.round((meta.width - newWidth) / 2)
  return img.extract({ left, top: 0, width: newWidth, height: meta.height }).jpeg().toBuffer()
}
