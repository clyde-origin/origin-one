'use client'

import { useStorageImage } from '@/lib/auth/useStorageImage'

type ImgAttrs = React.ImgHTMLAttributes<HTMLImageElement>

/**
 * <img> wrapper that signs Supabase publicUrls into private-bucket signed URLs
 * via useStorageImage. Use anywhere we'd otherwise write `<img src={url}>`
 * for moodboard, storyboard, or entity-attachments imagery.
 *
 * Renders nothing (or a placeholder if provided) while signing or on error.
 *
 * Avatars and external URLs pass through unchanged.
 */
export function StorageImage({
  url,
  placeholder = null,
  ...imgProps
}: {
  url: string | null | undefined
  placeholder?: React.ReactNode
} & Omit<ImgAttrs, 'src'>) {
  const signed = useStorageImage(url)
  if (!signed) return <>{placeholder}</>
  return <img src={signed} {...imgProps} />
}
