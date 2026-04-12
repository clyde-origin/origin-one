'use client'

import { forwardRef } from 'react'
import type { Scene } from '@/types'

export interface ScriptViewHandle {
  addScene: () => void
  addAction: () => void
  addDialogue: () => void
}

interface ScriptViewProps {
  scenes: Scene[]
  accent: string
}

// Script editor will be rebuilt in Phase 1C with the Document model.
// For now, return a placeholder.
export const ScriptView = forwardRef<ScriptViewHandle, ScriptViewProps>(function ScriptView({ scenes, accent }, ref) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16">
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>📝</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#dddde8', marginBottom: 4 }}>Script editor coming soon</div>
      <div className="font-mono text-center" style={{ fontSize: 11, color: '#62627a' }}>
        {scenes.length} scene{scenes.length !== 1 ? 's' : ''} in this project
      </div>
    </div>
  )
})
