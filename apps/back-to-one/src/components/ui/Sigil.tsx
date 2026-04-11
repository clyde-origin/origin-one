'use client'

import { goldenSpiralPath } from '@/lib/utils/phase'

export function Sigil({ size = 34, opacity = 0.7 }: { size?: number; opacity?: number }) {
  const cx = 32, cy = 32, r = 30
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ opacity, flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} stroke="white" strokeWidth="1.8" opacity="0.9" />
      <path d={goldenSpiralPath(cx, cy, r - 1)} stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <circle cx={cx} cy={cy} r={1.8} fill="white" opacity="0.9" />
    </svg>
  )
}
