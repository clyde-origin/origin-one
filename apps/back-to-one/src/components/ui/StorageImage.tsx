'use client'

import Image from 'next/image'
import type { CSSProperties } from 'react'
import { useStorageImage } from '@/lib/auth/useStorageImage'

type ImgAttrs = React.ImgHTMLAttributes<HTMLImageElement>

// Properties that determine the wrapper's box (sizing + positioning + the
// clip shape) get lifted onto the wrapper span; everything else stays on
// the inner Image. `borderRadius` is duplicated to both — the wrapper has
// `overflow: hidden` so a rounded wrapper visually clips the image, and we
// also apply it to the image so a non-cover fit still renders rounded.
const WRAPPER_STYLE_KEYS = new Set([
  'width', 'height',
  'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'position', 'top', 'right', 'bottom', 'left', 'inset',
  'flexShrink', 'flexGrow', 'flexBasis',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'display',
])
const SHARED_STYLE_KEYS = new Set(['borderRadius'])

function splitStyle(style: CSSProperties | undefined): { wrapper: CSSProperties; inner: CSSProperties } {
  const wrapper: CSSProperties = {}
  const inner: CSSProperties = {}
  if (!style) return { wrapper, inner }
  for (const [k, v] of Object.entries(style)) {
    if (SHARED_STYLE_KEYS.has(k)) {
      ;(wrapper as Record<string, unknown>)[k] = v
      ;(inner as Record<string, unknown>)[k] = v
    } else if (WRAPPER_STYLE_KEYS.has(k)) {
      ;(wrapper as Record<string, unknown>)[k] = v
    } else {
      ;(inner as Record<string, unknown>)[k] = v
    }
  }
  return { wrapper, inner }
}

/**
 * <next/image> wrapper that signs Supabase publicUrls into private-bucket
 * signed URLs via useStorageImage. Drop-in replacement for the previous
 * raw-<img> StorageImage — same prop shape (url, alt, style, className,
 * placeholder, onError) — but now produces an AVIF/WebP srcset via the
 * Next.js image optimizer.
 *
 * Renders an absolutely-filled <Image fill> inside a relatively-positioned
 * span. Sizing/positioning style keys (width/height/position/inset/flex/
 * margin) are lifted to that span so callers passing the typical
 * `style={{ width: '100%', height: '100%', objectFit: 'cover' }}` continue
 * to behave identically. Visual styles (objectFit, borderRadius, opacity)
 * are forwarded to the inner Image.
 *
 * Renders the placeholder (or nothing) while signing or on error.
 */
export function StorageImage({
  url,
  placeholder = null,
  alt = '',
  className,
  style,
  sizes,
  onError,
  onClick,
  draggable,
  loading,
  fill = true,
}: {
  url: string | null | undefined
  placeholder?: React.ReactNode
  sizes?: string
  alt?: string
  className?: string
  style?: CSSProperties
  onError?: ImgAttrs['onError']
  onClick?: ImgAttrs['onClick']
  draggable?: boolean
  loading?: 'eager' | 'lazy'
  /**
   * `true` (default) — render `<Image fill>` inside a relatively-positioned
   * wrapper. Callers should size the wrapper via `style` (the typical
   * `width: 100%; height: 100%` pattern works as before).
   *
   * `false` — render a raw `<img>` instead. Use this when the image needs
   * its intrinsic aspect ratio (e.g. inline body image with `maxHeight`).
   * Skips Next's image optimizer for that one caller.
   */
  fill?: boolean
}) {
  const signed = useStorageImage(url)
  if (!signed) return <>{placeholder}</>

  if (!fill) {
    // Legacy raw <img> path — used by inline body images that need
    // intrinsic aspect ratio (no fixed height container).
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={signed}
        alt={alt}
        className={className}
        style={style}
        onError={onError}
        onClick={onClick}
        draggable={draggable}
        loading={loading}
      />
    )
  }

  const { wrapper, inner } = splitStyle(style)
  // Default sizes — assume the image fills roughly half the viewport on
  // mobile, so the optimizer picks a sensible bucket. Callers can override
  // (e.g. fixed 26-px shot strip avatars).
  const sizesAttr = sizes ?? '(max-width: 768px) 100vw, 50vw'

  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...wrapper,
      }}
      onClick={onClick as React.MouseEventHandler<HTMLSpanElement> | undefined}
    >
      <Image
        src={signed}
        alt={alt}
        fill
        sizes={sizesAttr}
        style={{ objectFit: 'cover', ...inner }}
        onError={onError}
        draggable={draggable}
        loading={loading}
        // Most callers want decorative imagery without aggressive eager-load
        // — `next/image`'s default lazy loading is correct.
      />
    </span>
  )
}
