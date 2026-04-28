'use client'

import { useQuery } from '@tanstack/react-query'
import { createBrowserAuthClient } from '@origin-one/auth'
import { useSupabaseSession } from './useSupabaseSession'

export type ViewerRole = 'producer' | 'crew' | null

/**
 * Returns the viewer's permission tier. With projectId, returns the
 * tier on that specific project. Without, returns producer if the user
 * has any TeamMember row (team-tier access anywhere), else crew.
 *
 * Returns null while resolving or for unauthenticated users.
 */
export function useViewerRole(projectId?: string): ViewerRole {
  const session = useSupabaseSession()
  const authId = session?.user.id ?? null

  const { data } = useQuery({
    queryKey: ['viewerRole', authId, projectId ?? 'global'],
    queryFn: async (): Promise<ViewerRole> => {
      if (!authId) return null
      const db = createBrowserAuthClient()

      if (projectId) {
        // Check this user's ProjectMember row(s) on the project.
        const { data } = await db
          .from('ProjectMember')
          .select('role, User!inner(authId)')
          .eq('projectId', projectId)
          .eq('User.authId', authId)
        if (!data || data.length === 0) return 'crew'
        const isProducer = data.some((r: any) => r.role === 'producer' || r.role === 'director')
        return isProducer ? 'producer' : 'crew'
      }

      // No projectId: producer if any TeamMember row exists.
      const { data: tm } = await db
        .from('TeamMember')
        .select('id, User!inner(authId)')
        .eq('User.authId', authId)
        .limit(1)
      return (tm && tm.length > 0) ? 'producer' : 'crew'
    },
    enabled: !!authId,
  })

  return data ?? null
}
