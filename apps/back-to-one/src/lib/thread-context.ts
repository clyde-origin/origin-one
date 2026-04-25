'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import * as db from '@/lib/db/queries'
import type { Thread, ThreadAttachmentType } from '@/types'

export type ChipType =
  | 'obj-shot'
  | 'obj-scene'
  | 'obj-location'
  | 'obj-character'
  | 'obj-cast'
  | 'obj-crew'
  | 'obj-prop'
  | 'obj-wardrobe'
  | 'obj-hmu'
  | 'obj-moodboardRef'
  | 'obj-actionItem'
  | 'obj-milestone'
  | 'obj-deliverable'
  | 'obj-workflowStage'
  | 'obj-inventoryItem'

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

// Chip keys map to BRAND_TOKENS accents defined in threads/page.tsx CHIP_STYLES.
// Non-phase accents only — amber/indigo/teal are reserved for Pre/Prod/Post.
export function chipForType(t: ThreadAttachmentType): ChipType {
  switch (t) {
    case 'shot':          return 'obj-shot'          // violet      #9b6ef3
    case 'scene':         return 'obj-scene'         // lavender    #b890f0
    case 'location':      return 'obj-location'      // green       #3cbe6a
    case 'character':     return 'obj-character'     // rose        #e8507a
    case 'cast':          return 'obj-cast'          // coral       #f07050
    case 'crew':          return 'obj-crew'          // slate       #6888b8
    case 'prop':          return 'obj-prop'          // orange      #f08030
    case 'wardrobe':      return 'obj-wardrobe'      // pink        #e868c8
    case 'hmu':           return 'obj-hmu'           // mint        #50d898
    case 'moodboardRef':  return 'obj-moodboardRef'  // warm white  #e8e0d0
    case 'actionItem':    return 'obj-actionItem'    // gold        #e8c44a
    case 'milestone':     return 'obj-milestone'     // cyan        #22d4d4
    case 'deliverable':   return 'obj-deliverable'   // red         #e84848
    case 'workflowStage': return 'obj-workflowStage' // lime        #a8d428
    case 'inventoryItem': return 'obj-inventoryItem' // cerulean    #3a98c8
    default:              return 'obj-actionItem'
  }
}

export function gradientForType(t: ThreadAttachmentType): string {
  switch (t) {
    case 'shot':          return 'th-shot'
    case 'scene':         return 'th-scene'
    case 'location':      return 'th-location'
    case 'character':     return 'th-character'
    case 'cast':          return 'th-cast'
    case 'crew':          return 'th-crew'
    case 'prop':          return 'th-prop'
    case 'wardrobe':      return 'th-wardrobe'
    case 'hmu':           return 'th-hmu'
    case 'moodboardRef':  return 'th-moodboardRef'
    case 'actionItem':    return 'th-actionItem'
    case 'milestone':     return 'th-milestone'
    case 'deliverable':   return 'th-deliverable'
    case 'workflowStage': return 'th-workflowStage'
    case 'inventoryItem': return 'th-inventoryItem'
    default:              return 'th-actionItem'
  }
}

function labelForType(t: ThreadAttachmentType): string {
  switch (t) {
    case 'shot':          return 'Shot'
    case 'scene':         return 'Scene'
    case 'location':      return 'Location'
    case 'character':     return 'Character'
    case 'cast':          return 'Cast'
    case 'crew':          return 'Crew'
    case 'prop':          return 'Prop'
    case 'wardrobe':      return 'Wardrobe'
    case 'hmu':           return 'HMU'
    case 'moodboardRef':  return 'Moodboard'
    case 'actionItem':    return 'Action Item'
    case 'milestone':     return 'Milestone'
    case 'deliverable':   return 'Deliverable'
    case 'workflowStage': return 'Workflow'
    case 'inventoryItem': return 'Inventory item'
    default:              return 'Thread'
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

  // Entity table backs character, prop, wardrobe, hmu (all rows with matching `type`).
  const needsEntities =
    typesPresent.has('character') ||
    typesPresent.has('prop') ||
    typesPresent.has('wardrobe') ||
    typesPresent.has('hmu')

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
        enabled: !!projectId && (typesPresent.has('prop') || typesPresent.has('wardrobe') || typesPresent.has('hmu')),
      },
      {
        queryKey: ['characters', projectId],
        queryFn: () => db.getEntities(projectId, 'character'),
        enabled: !!projectId && typesPresent.has('character'),
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
        queryKey: ['moodboardRefs', projectId],
        queryFn: () => db.getMoodboardRefs(projectId),
        enabled: !!projectId && typesPresent.has('moodboardRef'),
      },
      {
        queryKey: ['workflowNodes', projectId],
        queryFn: () => db.getWorkflowNodes(projectId),
        enabled: !!projectId && typesPresent.has('workflowStage'),
      },
      {
        queryKey: ['inventoryItems', projectId],
        queryFn: () => db.getInventoryItems(projectId),
        enabled: !!projectId && typesPresent.has('inventoryItem'),
      },
    ],
  })
  void needsEntities

  const [
    sceneBundles,
    scenes,
    actionItems,
    castRoles,
    artItems,
    characters,
    deliverables,
    locations,
    milestones,
    crew,
    moodboardRefs,
    workflowNodes,
    inventoryItems,
  ] = results.map(r => r.data) as [
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
    const charactersById = new Map<string, any>((characters ?? []).map(c => [c.id, c]))
    const deliverablesById = new Map<string, any>((deliverables ?? []).map(d => [d.id, d]))
    const locationsById = new Map<string, any>((locations ?? []).map(l => [l.id, l]))
    const milestonesById = new Map<string, any>((milestones ?? []).map(m => [m.id, m]))
    const crewById = new Map<string, any>((crew ?? []).map(c => [c.userId, c]))
    const moodboardRefsById = new Map<string, any>((moodboardRefs ?? []).map(r => [r.id, r]))
    const workflowNodesById = new Map<string, any>((workflowNodes ?? []).map(n => [n.id, n]))
    const inventoryItemsById = new Map<string, any>((inventoryItems ?? []).map(i => [i.id, i]))

    const out = new Map<string, ThreadContext>()
    for (const t of threads) {
      out.set(t.id, buildContext(t, {
        shotsById,
        scenesById,
        actionItemsById,
        castById,
        artById,
        charactersById,
        deliverablesById,
        locationsById,
        milestonesById,
        crewById,
        moodboardRefsById,
        workflowNodesById,
        inventoryItemsById,
      }))
    }
    return out
  }, [threads, sceneBundles, scenes, actionItems, castRoles, artItems, characters, deliverables, locations, milestones, crew, moodboardRefs, workflowNodes, inventoryItems])
}

interface Maps {
  shotsById: Map<string, { shot: any; sceneTitle: string; sceneNumber: string }>
  scenesById: Map<string, any>
  actionItemsById: Map<string, any>
  castById: Map<string, any>
  artById: Map<string, any>
  charactersById: Map<string, any>
  deliverablesById: Map<string, any>
  locationsById: Map<string, any>
  milestonesById: Map<string, any>
  crewById: Map<string, any>
  moodboardRefsById: Map<string, any>
  workflowNodesById: Map<string, any>
  inventoryItemsById: Map<string, any>
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
    case 'character': {
      const c = m.charactersById.get(thread.attachedToId)
      if (!c) return genericContext(type)
      return {
        displayLabel: c.name,
        chipType: 'obj-character',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-character',
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
    case 'crew': {
      const cm = m.crewById.get(thread.attachedToId)
      if (!cm) return genericContext(type)
      const name = cm.User?.name ?? 'Crew'
      return {
        displayLabel: `${name} · ${cm.role}`,
        chipType: 'obj-crew',
        thumbnailType: 'avatar',
        thumbnailValue: name,
        thumbnailGradient: 'th-crew',
      }
    }
    case 'prop': {
      const a = m.artById.get(thread.attachedToId)
      if (!a || a.type !== 'prop') return genericContext(type)
      return {
        displayLabel: `Prop: ${a.name}`,
        chipType: 'obj-prop',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-prop',
      }
    }
    case 'wardrobe': {
      const a = m.artById.get(thread.attachedToId)
      if (!a || a.type !== 'wardrobe') return genericContext(type)
      return {
        displayLabel: `Wardrobe: ${a.name}`,
        chipType: 'obj-wardrobe',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-wardrobe',
      }
    }
    case 'hmu': {
      const a = m.artById.get(thread.attachedToId)
      if (!a || a.type !== 'hmu') return genericContext(type)
      return {
        displayLabel: `HMU: ${a.name}`,
        chipType: 'obj-hmu',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-hmu',
      }
    }
    case 'moodboardRef': {
      const r = m.moodboardRefsById.get(thread.attachedToId)
      if (!r) return genericContext(type)
      return {
        displayLabel: `Moodboard: ${r.title}`,
        chipType: 'obj-moodboardRef',
        thumbnailType: r.imageUrl ? 'image' : 'icon',
        thumbnailValue: r.imageUrl ?? null,
        thumbnailGradient: 'th-moodboardRef',
      }
    }
    case 'actionItem': {
      const a = m.actionItemsById.get(thread.attachedToId)
      if (!a) return genericContext(type)
      return {
        displayLabel: `Action: ${a.title}`,
        chipType: 'obj-actionItem',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-actionItem',
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
    case 'deliverable': {
      const d = m.deliverablesById.get(thread.attachedToId)
      if (!d) return genericContext(type)
      return {
        displayLabel: `Deliverable: ${d.title}`,
        chipType: 'obj-deliverable',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-deliverable',
      }
    }
    case 'workflowStage': {
      const n = m.workflowNodesById.get(thread.attachedToId)
      if (!n) return genericContext(type)
      return {
        displayLabel: `Workflow: ${n.label}`,
        chipType: 'obj-workflowStage',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-workflowStage',
      }
    }
    case 'inventoryItem': {
      const i = m.inventoryItemsById.get(thread.attachedToId)
      if (!i) return genericContext(type)
      return {
        displayLabel: `Inventory: ${i.name}`,
        chipType: 'obj-inventoryItem',
        thumbnailType: 'icon',
        thumbnailValue: null,
        thumbnailGradient: 'th-inventoryItem',
      }
    }
    default:
      return genericContext(type)
  }
}
