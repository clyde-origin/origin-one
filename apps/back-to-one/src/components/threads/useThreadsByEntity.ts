'use client'

import { useMemo } from 'react'
import { useThreadPreviews } from '@/lib/hooks/useOriginOne'
import type { ThreadAttachmentType } from '@/types'
import type { ThreadRowBadgeEntry } from './ThreadRowBadge'

// One project-level thread query per page, bucketed in memory by attachedToId.
// Mirrors the shotlist pattern — no per-entity fetch, no N+1.
//
// attachedToId keys per entity type:
//   'shot'          → Shot.id
//   'cast'          → Talent.id
//   'character'     → Entity.id      (type='character')
//   'prop'          → Entity.id      (type='prop')
//   'wardrobe'      → Entity.id      (type='wardrobe')
//   'hmu'           → Entity.id      (type='hmu')
//   'location'      → Location.id    (physical record, NOT Entity type='location')
//   'workflowStage' → WorkflowNode.id
//   'deliverable'   → Deliverable.id
//   'milestone'     → Milestone.id
//   'actionItem'    → ActionItem.id
//   'moodboardRef'  → MoodboardRef.id
//   'crew'          → User.id

export function useThreadsByEntity(
  projectId: string,
  attachedToType: ThreadAttachmentType,
): Map<string, ThreadRowBadgeEntry> {
  const { data: threads } = useThreadPreviews(projectId)
  return useMemo(() => {
    const map = new Map<string, ThreadRowBadgeEntry>()
    for (const t of (threads ?? [])) {
      if (t.attachedToType !== attachedToType) continue
      map.set(t.attachedToId, {
        count: t.messages?.length ?? 0,
        unread: !!t.unread,
      })
    }
    return map
  }, [threads, attachedToType])
}
