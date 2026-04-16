'use client'

import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/utils/haptics'
import { ThreadsIcon } from '@/components/ui/ThreadsIcon'

interface SideFabsProps {
  projectId: string
  hideLeft?: boolean
  hideRight?: boolean
}

export function SideFabs({ projectId, hideLeft, hideRight }: SideFabsProps) {
  const router = useRouter()

  const sideStyle = {
    width: 44, height: 44,
    background: '#0f0f1a',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    bottom: 68,
  } as const

  return (
    <>
      {/* Chat — left */}
      {!hideLeft && (
        <button
          className="fixed z-20 flex items-center justify-center rounded-full active:scale-[0.91] transition-transform"
          style={{ ...sideStyle, left: 18 }}
          onClick={() => { haptic('light'); router.push(`/projects/${projectId}/chat`) }}
          aria-label="Chat"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v7a2 2 0 01-2 2H7l-4 3V5z" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          </svg>
        </button>
      )}

      {/* Threads — right */}
      {!hideRight && (
        <button
          className="fixed z-20 flex items-center justify-center rounded-full active:scale-[0.91] transition-transform"
          style={{ ...sideStyle, right: 18 }}
          onClick={() => { haptic('light'); router.push(`/projects/${projectId}/resources`) }}
          aria-label="Threads"
        >
          <ThreadsIcon size={18} color="rgba(255,255,255,0.7)" />
        </button>
      )}
    </>
  )
}
