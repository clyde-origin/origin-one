'use client'

import { useState } from 'react'

// ── CREW AVATAR ──────────────────────────────────────────────

const AVATAR_COLORS = [
  ['#e8a020', '#d4782c'], ['#6470f3', '#8b5cf6'], ['#00b894', '#00857a'],
  ['#c45adc', '#9b4dca'], ['#e87060', '#d35448'], ['#3b82f6', '#2563eb'],
  ['#f59e0b', '#d97706'], ['#10b981', '#059669'],
]

function avatarGradient(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const pair = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
  return [pair[0], pair[1]]
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (name[0] ?? '?').toUpperCase()
}

export function CrewAvatar({
  name,
  size = 38,
  avatarUrl,
}: {
  name: string
  size?: number
  avatarUrl?: string | null
}) {
  const [c1] = avatarGradient(name)
  const initials = avatarInitials(name)
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = !!avatarUrl && !imgFailed
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center font-semibold overflow-hidden"
        style={{
          width: size,
          height: size,
          background: '#0a0a12',
          border: `0.5px solid ${c1}`,
          color: c1,
          fontSize: size * 0.26,
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl!}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          initials
        )}
      </div>
    </div>
  )
}
