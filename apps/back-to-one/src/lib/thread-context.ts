'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import * as db from '@/lib/db/queries'
import type { Thread, ThreadAttachmentType } from '@/types'

export type ChipType =
  | 'obj-shot'
  | 'obj-scene'
  | 'obj-task'
  | 'obj-cast'
  | 'obj-art'
  | 'obj-location'
  | 'obj-milestone'

export type ThumbType = 'image' | 'avatar' | 'icon'

export interface ThreadContext {
  displayLabel: string
  chipType: ChipType
  thumbnailType: ThumbType
  thumbnailValue: string | null
  thumbnailGradient: string
}

// Fallback used while source data is loading or when attachedToId is unknown.
export function genericContext(attachedToType: string): ThreadContext {
  const t = attachedToType as ThreadAttachmentType
  return {
    displayLabel: labelForType(t),
    chipType: chipForType(t),
    thumbnailType: 'icon',
    thumbnailValue: null,
    thumbnailGradient: gradientForType(t),
  }
}

export function chipForType(t: ThreadAttachmentType): ChipType {
  switch (t) {
    case 'shot':         return 'obj-shot'
    case 'scene':        return 'obj-scene'
    case 'actionItem':   return 'obj-task'
    case 'cast':         return 'obj-cast'
    case 'art':          return 'obj-art'
    case 'deliverable':  return 'obj-task'
    case 'location':     return 'obj-location'
    case 'milestone':    return 'obj-milestone'
    case 'crew':         return 'obj-task'
    case 'chatMessage':  return 'obj-scene'
    default:             return 'obj-task'
  }
}

export function gradientForType(t: ThreadAttachmentType): string {
  switch (t) {
    case 'shot':        return 'th-shot'
    case 'scene':       return 'th-scene'
    case 'actionItem':  return 'th-task'
    case 'cast':        return 'th-cast'
    case 'art':         return 'th-art'
    case 'deliverable': return 'th-task'
    case 'location':    return 'th-location'
    case 'milestone':   return 'th-milestone'
    case 'crew':        return 'th-task'
    case 'chatMessage': return 'th-scene'
    default:            return 'th-task'
  }
}

function labelForType(t: ThreadAttachmentType): string {
  switch (t) {
    case 'shot':        return 'Shot'
    case 'scene':       return 'Scene'
    case 'actionItem':  return 'Action Item'
    case 'cast':        return 'Cast'
    case 'art':         return 'Art'
    case 'deliverable': return 'Deliverable'
    case 'location':    return 'Location'
    case 'milestone':   return 'Milestone'
    case 'crew':        return 'Crew'
    case 'chatMessage': return 'Chat'
    default:            return 'Thread'
  }
}

/**
 * Resolve `(attachedToType, attachedToId)` pairs into rendered context.
 * Loads one batched query per type that appears in `threads`, never per thread.
 * Threads whose attached record is missing (deleted) fall back to generic context.
 */
export function useThreadContexts(
  projectId: string,
  threads: Thread[],
): Map<string, ThreadContext> {
  const typesPresent = useMemo(() => {
    const s = new Set<ThreadAttachmentType>()
    for (const t of threads) s.add(t.attachedToType)
    return s
  }, [threads])

  const results = useQueries({
    queries: [
      {
        queryKey: ['shotsByProject', projectId],
        queryFn: () => db.getShotsByProject(projectId),
        enabled: !!projectId && typesPresent.has('shot'),
      },
      {
        queryKey: ['scenes', projectId],
        queryFn: () => db.getScenes(projectId),
        enabled: !!projectId && (typesPresent.has('scene') || typesPresent.has('shot')),
      },
      {
        queryKey: ['actionItems', projectId],
        queryFn: () => db.getActionItems(projectId),
        enabled: !!projectId && typesPresent.has('actionItem'),
      },
      {
        queryKey: ['castRoles', projectId],
        queryFn: () => db.getCastRoles(projectId),
        enabled: !!projectId && typesPresent.has('cast'),
      },
      {
        queryKey: ['artItems', projectId],
        queryFn: () => db.getArtItems(projectId),
        enabled: !!projectId && typesPresent.has('art'),
      },
      {
        queryKey: ['deliverables', projectId],
        queryFn: () => db.getDeliverables(projectId),
        enabled: !!projectId && typesPresent.has('deliverable'),
      },
      {
        queryKey: ['locations', projectId],
        queryFn: () => db.getLocations(projectId),
        enabled: !!projectId && typesPresent.has('location'),
      },
      {
        queryKey: ['milestones', projectId],
        queryFn: () => db.getMilestones(projectId),
        enabled: !!projectId && typesPresent.has('milestone'),
      },
      {
        queryKey: ['crew', projectId],
        queryFn: () => db.getCrew(projectId),
        enabled: !!projectId && (typesPresent.has('crew') || typesPresent.has('shot') || typesPresent.has('scene')),
      },
      {
        queryKey: ['chatChannels', projectId],
        queryFn: () => db.getChatChannels(projectId),
        enabled: !!projectId && typesPresent.has('chatMessage'),
      },
    ],
  })

  const [sceneBundles, scenes, actionItems, castRoles, artItems, deliverables, locations, milestones, crew, chatChannels] = results.map(r => r.data) as [
    any[] | undefined,
    any[] | undefined,
    any[] | undefined,
    any[] | undefined,
    any[] | undefined,
    any[] | undefined,
    any[] | undefined,
    any[] | undefined,
    any[] | undefined,
    any[] | undefined,
  ]

  return useMemo(() => {
    const shotsById = new Map<string, { shot: any; sceneTitle: string; sceneNumber: string }>()
    if (sceneBundles) {
      for (const sc of sceneBundles) {
        const sceneTitle = sc.title ?? ''
        const sceneNumber = sc.sceneNumber ?? ''
        for (const shot of (sc.Shot ?? [])) {
          shotsById.set(shot.id, { shot, sceneTitle, sceneNumber })
        }
      }
    }
    const scenesById = new Map<string, any>((scenes ?? []).map(s => [s.id, s]))
    const actionItemsById = new Map<string, any>((actionItems ?? []).map(a => [a.id, a]))
    const castById = new Map<string, any>((castRoles ?? []).map(c => [c.id, c]))
    const artById = new Map<string, any>((artItems ?? []).map(a => [a.id, a]))
    const deliverablesById = new Map<string, any>((deliverables ?? []).map(d => [d.id, d]))
    const locationsById = new Map<string, any>((locations ?? []).map(l => [l.id, l]))
    const milestonesById = new Map<string, any>((milestones ?? []).map(m => [m.id, m]))
    const crewById = new Map<string, any>((crew ?? []).map(c => [c.userId, c]))
    const channelsById = new Map<string, any>((chatChannels ?? []).map(ch => [ch.id, ch]))

    const out = new Map<string, ThreadContext>()
    for (const t of threads) {
      out.set(t.id, buildContext(t, {
        shotsById,
        scenesById,
        actionItemsById,
        castById,
        artById,
        deliverablesById,
        locationsById,
        milestonesById,
        crewById,
        channelsById,
      }))
    }
    return out
  }, [threads, sceneBundles, scenes, actionItems, castRoles, artItems, deliverables, locations, milestones, crew, chatChannels])
}

interface Maps {
  shotsById: Map<string, { shot: any; sceneTitle: string; sceneNumber: string }>
  scenesById: Map<string, any>
  actionItemsById: Map<string, any>
  castById: Map<string, any>
  artById: Map<string, any>
  deliverablesById: Map<string, any>
  locationsById: Map<string, any>
  milestonesById: Map<string, any>
  crewById: Map<string, any>
  channelsById: Map<string, any>
}

function buildContext(thread: Thread, m: Maps): ThreadContext {
  const type = thread.attachedToType
  switch (type) {
    case 'shot': {
      const entry = m.shotsById.get(thread.attachedToId)
      if (!entry) return genericContext(type)
      const label = entry.sceneTitle
        ? `Shot ${entry.shot.shotNumber} · ${entry.sceneTitle}`
        : `Shot ${entry.shot.shotNumber}`
      return {
        displayLabel: label,
        chipType: 'obj-shot',
        thumbnailType: entry.shot.imageUrl ? 'image' : 'icon',
        thumbnailValue: entry.shot.imageUrl ?? entry.shot.shotNumber ?? null,
        thumbnailGradient: 'th-shot',
      }
    }
    case 'scene': {
      const s = m.scenesById.get(thread.attachedToId)
      if (!s) return genericContext(type)
      const label = s.title ? `Scene ${s.sceneNumber} · ${s.title}` : `Scene ${s.sceneNumber}`
      return {
        displayLabel: label,
        chipType: 'obj-scene',
        thumbnailType: 'icon',
        thumbnailValue: s.sceneNumber ?? null,
        thumbnailGradient: 'th-scene',
      }
    }
    case 'actionItem': {
      const a = m.actionItemsById.get(thread.attachedToId)
      if (!a) return genericContext(type)
      return {
        displayLabel: `Action: ${a.title}`,
        chipType: 'obj-task',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-task',
      }
    }
    case 'cast': {
      const c = m.castById.get(thread.attachedToId)
      if (!c) return genericContext(type)
      return {
        displayLabel: `Cast: ${c.role}`,
        chipType: 'obj-cast',
        thumbnailType: 'avatar',
        thumbnailValue: c.talent?.name ?? c.role,
        thumbnailGradient: 'th-cast',
      }
    }
    case 'art': {
      const a = m.artById.get(thread.attachedToId)
      if (!a) return genericContext(type)
      return {
        displayLabel: `Art: ${a.name}`,
        chipType: 'obj-art',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-art',
      }
    }
    case 'deliverable': {
      const d = m.deliverablesById.get(thread.attachedToId)
      if (!d) return genericContext(type)
      return {
        displayLabel: `Deliverable: ${d.title}`,
        chipType: 'obj-task',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-task',
      }
    }
    case 'location': {
      const l = m.locationsById.get(thread.attachedToId)
      if (!l) return genericContext(type)
      return {
        displayLabel: `Location: ${l.name}`,
        chipType: 'obj-location',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-location',
      }
    }
    case 'milestone': {
      const ms = m.milestonesById.get(thread.attachedToId)
      if (!ms) return genericContext(type)
      return {
        displayLabel: `Milestone: ${ms.title}`,
        chipType: 'obj-milestone',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-milestone',
      }
    }
    case 'crew': {
      const cm = m.crewById.get(thread.attachedToId)
      if (!cm) return genericContext(type)
      const name = cm.User?.name ?? 'Crew'
      return {
        displayLabel: `${name} · ${cm.role}`,
        chipType: 'obj-task',
        thumbnailType: 'avatar',
        thumbnailValue: name,
        thumbnailGradient: 'th-task',
      }
    }
    case 'chatMessage': {
      const ch = m.channelsById.get(thread.attachedToId)
      return {
        displayLabel: ch ? `Chat: ${ch.name}` : 'Chat',
        chipType: 'obj-scene',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-scene',
      }
    }
    default:
      return genericContext(type)
  }
}
