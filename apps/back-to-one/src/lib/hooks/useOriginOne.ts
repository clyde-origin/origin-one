import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as db from '@/lib/db/queries'
import { createBrowserAuthClient } from '@origin-one/auth'
import { useSupabaseSession } from '@/lib/auth/useSupabaseSession'

// ── QUERY KEYS — one place, no magic strings ───────────────

export const keys = {
  projects:           () => ['projects'] as const,
  projectsWithBudgets: () => ['projectsWithBudgets'] as const,
  project:            (id: string) => ['projects', id] as const,
  crew:               (teamId: string) => ['crew', teamId] as const,
  actionItems:        (projectId: string) => ['actionItems', projectId] as const,
  milestones:         (projectId: string) => ['milestones', projectId] as const,
  allActionItems:     () => ['allActionItems'] as const,
  allMilestones:      () => ['allMilestones'] as const,
  allThreads:         (meId: string | null) => ['allThreads', meId ?? ''] as const,
  allChats:           (meId: string | null) => ['allChats', meId ?? ''] as const,
  userProjectFolders:         (meId: string | null) => ['userProjectFolders', meId ?? ''] as const,
  archivedUserProjectFolders: (meId: string | null) => ['archivedUserProjectFolders', meId ?? ''] as const,
  userProjectPlacements:      (meId: string | null) => ['userProjectPlacements', meId ?? ''] as const,
  allResources:       () => ['allResources'] as const,
  shotlistVersions: (projectId: string) => ['shotlistVersions', projectId] as const,
  scenes:         (projectId: string) => ['scenes', projectId] as const,
  shots:          (sceneId: string) => ['shots', sceneId] as const,
  moodboard:      (projectId: string) => ['moodboard', projectId] as const,
  moodboardTabs:  (projectId: string) => ['moodboardTabs', projectId] as const,
  locations:      (projectId: string) => ['locations', projectId] as const,
  inventoryItems: (projectId: string) => ['inventoryItems', projectId] as const,
  shootDays:      (projectId: string) => ['shootDays', projectId] as const,
  budget:         (projectId: string) => ['budget', projectId] as const,
  castRoles:      (projectId: string) => ['castRoles', projectId] as const,
  artItems:       (projectId: string) => ['artItems', projectId] as const,
  threads:        (projectId: string, meId: string | null) => ['threads', projectId, meId ?? ''] as const,
  threadPreviews: (projectId: string, meId: string | null) => ['threadPreviews', projectId, meId ?? ''] as const,
  folders:        (projectId: string) => ['folders', projectId] as const,
  resources:      (projectId: string) => ['resources', projectId] as const,
  workflowNodes:  (projectId: string) => ['workflowNodes', projectId] as const,
  workflowEdges:  (projectId: string) => ['workflowEdges', projectId] as const,
  deliverables:   (projectId: string) => ['deliverables', projectId] as const,
  chatChannels:   (projectId: string) => ['chatChannels', projectId] as const,
  chatMessages:   (channelId: string) => ['chatMessages', channelId] as const,
  dmMessages:     (projectId: string, a: string, b: string) => ['dmMessages', projectId, a, b] as const,
  dmList:         (projectId: string, me: string) => ['dmList', projectId, me] as const,
  allCrew:        () => ['allCrew'] as const,
  timecardsByWeek: (projectId: string, weekStartISO: string) =>
    ['timecardsByWeek', projectId, weekStartISO] as const,
}

// ── PROJECTS ───────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: keys.projects(),
    queryFn:  db.getProjects,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: keys.project(id),
    queryFn:  () => db.getProject(id),
    enabled:  !!id,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects() }),
  })
}

export function useArchiveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.archiveProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.projects() })
      qc.invalidateQueries({ queryKey: ['archivedProjects'] })
    },
  })
}

export function useArchivedProjects() {
  return useQuery({
    queryKey: ['archivedProjects'] as const,
    queryFn:  db.getArchivedProjects,
  })
}

export function useRestoreProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.restoreProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.projects() })
      qc.invalidateQueries({ queryKey: ['archivedProjects'] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects() }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string; status?: string; color?: string; client?: string; type?: string; aspectRatio?: string } }) =>
      db.updateProject(id, fields),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: keys.projects() })
      qc.invalidateQueries({ queryKey: keys.project(id) })
    },
  })
}

// ── FOLDERS ───────────────────────────────────────────────

export function useFolders(projectId: string) {
  return useQuery({
    queryKey: keys.folders(projectId),
    queryFn:  () => db.getFolders(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createFolder,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.folders(projectId) }),
  })
}

export function useUpdateFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string } }) =>
      db.updateFolder(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.folders(projectId) }),
  })
}

export function useDeleteFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.folders(projectId) })
      qc.invalidateQueries({ queryKey: keys.projects() })
    },
  })
}

// ── CREW ───────────────────────────────────────────────────

export function useAllCrew() {
  return useQuery({
    queryKey: keys.allCrew(),
    queryFn: db.getAllCrew,
  })
}

export function useCrew(projectId: string) {
  return useQuery({
    queryKey: keys.crew(projectId),
    queryFn:  () => db.getCrew(projectId),
    enabled:  !!projectId,
  })
}

// Crew Profile v2 (#22) — phone is User-global so it invalidates every project's
// crew query that includes this user (broad invalidation matching keys.crew).
// Notes/skills mutations only invalidate the active project's crew query.
export function useUpdateUserPhone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, phone }: { userId: string; phone: string | null }) =>
      db.updateUserPhone(userId, phone),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.crew(projectId) }),
  })
}

export function useUpdateProjectMemberProfile(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectMemberId, fields }: {
      projectMemberId: string
      fields: { notes?: string | null; skills?: string[] }
    }) => db.updateProjectMemberProfile(projectMemberId, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.crew(projectId) }),
  })
}

// Avatar upload — invalidates the active project's crew query so the new
// avatarUrl renders immediately on the next paint.
export function useUploadAvatar(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, userId }: { file: File; userId: string }) =>
      db.uploadAvatar(file, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.crew(projectId) }),
  })
}

// Fetch CrewTimecard rows for the inclusive [weekStartISO, weekEndISO] range.
// Caller provides both bounds (typically Monday and the following Sunday as
// YYYY-MM-DD strings). The key includes the week start so switching weeks
// yields a fresh query rather than refetching a single mutable cache entry.
export function useCrewTimecardsByWeek(
  projectId: string,
  weekStartISO: string,
  weekEndISO: string,
) {
  return useQuery({
    queryKey: keys.timecardsByWeek(projectId, weekStartISO),
    queryFn:  () => db.getCrewTimecardsByWeek(projectId, weekStartISO, weekEndISO),
    enabled:  !!projectId && !!weekStartISO && !!weekEndISO,
  })
}

// All five timecard mutations share the same invalidation scope: every
// cached week for this project. Using the key prefix (not the full three-
// element key) hits all weekly buckets in one shot — a mutation in one week
// can't affect another, but the prefix form is simpler and the extra work
// is negligible.
function invalidateTimecards(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  qc.invalidateQueries({ queryKey: ['timecardsByWeek', projectId] })
  // approveTimecard / reopenTimecard side-effect on Expense → budget rollup must refresh.
  qc.invalidateQueries({ queryKey: keys.budget(projectId) })
}

export function useCreateTimecard(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createTimecard,
    onSuccess:  () => invalidateTimecards(qc, projectId),
  })
}

export function useUpdateTimecard(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { hours?: number; rate?: number | null; rateUnit?: 'day' | 'hour'; description?: string } }) =>
      db.updateTimecard(id, fields),
    onSuccess:  () => invalidateTimecards(qc, projectId),
  })
}

export function useSubmitTimecard(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.submitTimecard(id),
    onSuccess:  () => invalidateTimecards(qc, projectId),
  })
}

export function useApproveTimecard(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) =>
      db.approveTimecard(id, approvedBy),
    onSuccess:  () => invalidateTimecards(qc, projectId),
  })
}

export function useReopenTimecard(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reopenedBy, reopenReason }: { id: string; reopenedBy: string; reopenReason: string }) =>
      db.reopenTimecard(id, reopenedBy, reopenReason),
    onSuccess:  () => invalidateTimecards(qc, projectId),
  })
}

export function useAddCrewMember(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.addCrewMember,
    onSuccess:  () => qc.invalidateQueries({ queryKey: keys.crew(projectId) }),
  })
}

export function useRemoveCrewMember(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.removeCrewMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.crew(projectId) }),
  })
}

export function useUpdateCrewMember(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { role?: string } }) =>
      db.updateCrewMember(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.crew(projectId) }),
  })
}

// ── ACTION ITEMS ───────────────────────────────────────────

export function useActionItems(projectId: string) {
  return useQuery({
    queryKey: keys.actionItems(projectId),
    queryFn:  () => db.getActionItems(projectId),
    enabled:  !!projectId,
  })
}

export function useToggleActionItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      db.toggleActionItem(id, done),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: keys.actionItems(projectId) })
      const prev = qc.getQueryData(keys.actionItems(projectId))
      qc.setQueryData(keys.actionItems(projectId), (old: any[]) =>
        old?.map(item => item.id === id ? { ...item, status: done ? 'done' : 'open' } : item)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(keys.actionItems(projectId), ctx?.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.actionItems(projectId) })
    },
  })
}

export function useCreateActionItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createActionItem,
    onSuccess:  () => qc.invalidateQueries({ queryKey: keys.actionItems(projectId) }),
  })
}

export function useUpdateActionItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { title?: string; description?: string; assignedTo?: string | null; department?: string | null; dueDate?: string | null; status?: string } }) =>
      db.updateActionItem(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.actionItems(projectId) }),
  })
}

// ── MILESTONES ─────────────────────────────────────────────

export function useMilestones(projectId: string) {
  return useQuery({
    queryKey: keys.milestones(projectId),
    queryFn:  () => db.getMilestones(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateMilestone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createMilestone,
    onSuccess:  () => qc.invalidateQueries({ queryKey: keys.milestones(projectId) }),
  })
}

export function useUpdateMilestone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { title?: string; date?: string; status?: string; notes?: string } }) =>
      db.updateMilestone(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.milestones(projectId) }),
  })
}

export function useAddMilestonePerson(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ milestoneId, userId }: { milestoneId: string; userId: string }) =>
      db.addMilestonePerson(milestoneId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.milestones(projectId) }),
  })
}

export function useRemoveMilestonePerson(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ milestoneId, userId }: { milestoneId: string; userId: string }) =>
      db.removeMilestonePerson(milestoneId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.milestones(projectId) }),
  })
}

// ── SCENES + SHOTS ────────────────────────────────────────

export function useScenes(projectId: string) {
  return useQuery({
    queryKey: keys.scenes(projectId),
    queryFn:  () => db.getScenes(projectId),
    enabled:  !!projectId,
  })
}

export function useShots(sceneId: string) {
  return useQuery({
    queryKey: keys.shots(sceneId),
    queryFn:  () => db.getShots(sceneId),
    enabled:  !!sceneId,
  })
}

// ── SHOTLIST VERSIONS ────────────────────────────────────

export function useShotlistVersions(projectId: string) {
  return useQuery({
    queryKey: keys.shotlistVersions(projectId),
    queryFn:  () => db.getShotlistVersions(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateShotlistVersion(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (version: { versionNumber: number; label?: string | null; shots: any }) =>
      db.createShotlistVersion({ projectId, ...version }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.shotlistVersions(projectId) }) },
  })
}

export function useUpdateShotlistVersionLabel(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string | null }) =>
      db.updateShotlistVersionLabel(id, label),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.shotlistVersions(projectId) }) },
  })
}

// ── THREADS ────────────────────────────────────────────────

/**
 * Resolve the current user id (User.id, not auth.users.id).
 *
 * Reads the Supabase session, looks up the User row by authId, returns its id.
 * Returns null while resolving or for unauthenticated users.
 */
export function useMeId(): string | null {
  const session = useSupabaseSession()
  const authId = session?.user.id ?? null
  const { data } = useQuery({
    queryKey: ['meId', authId],
    queryFn: async (): Promise<string | null> => {
      if (!authId) return null
      const supa = createBrowserAuthClient()
      const { data } = await supa.from('User').select('id').eq('authId', authId).maybeSingle()
      return (data as { id: string } | null)?.id ?? null
    },
    enabled: !!authId,
  })
  return data ?? null
}

/**
 * Returns the current viewer's team name (the first TeamMember row's Team).
 * For crew-only users (no TeamMember rows), returns null. Producer/director
 * accounts get their team's name shown in the projects page header.
 */
export function useMyTeam(): { id: string; name: string } | null {
  const session = useSupabaseSession()
  const authId = session?.user.id ?? null
  const { data } = useQuery({
    queryKey: ['myTeam', authId],
    queryFn: async () => {
      if (!authId) return null
      const supa = createBrowserAuthClient()
      const { data } = await supa
        .from('TeamMember')
        .select('Team!inner(id, name), User!inner(authId)')
        .eq('User.authId', authId)
        .limit(1)
        .maybeSingle()
      const team = (data as { Team?: { id: string; name: string } } | null)?.Team
      return team ?? null
    },
    enabled: !!authId,
  })
  return data ?? null
}

export function useThreads(projectId: string) {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.threads(projectId, meId),
    queryFn:  () => db.getThreads(projectId, meId),
    enabled:  !!projectId,
  })
}

// Lighter twin of useThreads — same shape, but message rows omit the
// `content` body. Use everywhere the consumer only needs unread badges and
// message counts (Hub, useThreadsByEntity, scenemaker). Reserves the full
// fetch for the threads page itself.
export function useThreadPreviews(projectId: string) {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.threadPreviews(projectId, meId),
    queryFn:  () => db.getThreadPreviews(projectId, meId),
    enabled:  !!projectId,
  })
}

export function useCreateThread(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      attachedToType,
      attachedToId,
      createdBy,
    }: {
      attachedToType: string
      attachedToId: string
      createdBy: string
    }) => db.createThread(projectId, attachedToType, attachedToId, createdBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads', projectId] })
      qc.invalidateQueries({ queryKey: ['threadPreviews', projectId] })
      qc.invalidateQueries({ queryKey: ['allThreads'] })
    },
  })
}

export function usePostMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      threadId,
      createdBy,
      content,
    }: {
      threadId: string
      createdBy: string
      content: string
    }) => db.postMessage(threadId, createdBy, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads', projectId] })
      qc.invalidateQueries({ queryKey: ['threadPreviews', projectId] })
      qc.invalidateQueries({ queryKey: ['allThreads'] })
    },
  })
}

/**
 * Mark a thread read for the current user. Fires on zone-2 open (never on
 * sheet open) so the badge only clears when the viewer actually sees messages.
 * No-op if meId is unresolved.
 */
export function useMarkThreadRead(projectId: string) {
  const qc = useQueryClient()
  const meId = useMeId()
  return useMutation({
    mutationFn: (threadId: string) => {
      if (!meId) return Promise.resolve()
      return db.markThreadRead(threadId, meId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads', projectId] })
      qc.invalidateQueries({ queryKey: ['threadPreviews', projectId] })
      qc.invalidateQueries({ queryKey: ['allThreads'] })
    },
  })
}

// ── RESOURCES ──────────────────────────────────────────────

export function useResources(projectId: string) {
  return useQuery({
    queryKey: keys.resources(projectId),
    queryFn:  () => db.getResources(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateResource(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createResource,
    onSuccess:  () => qc.invalidateQueries({ queryKey: keys.resources(projectId) }),
  })
}

// Cross-project resources — projectId IS NULL, used by the projects-root
// bar's resources sheet (PR following #32).
export function useAllResources() {
  return useQuery({
    queryKey: keys.allResources(),
    queryFn:  db.getAllResources,
  })
}

export function useCreateGlobalResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createGlobalResource,
    onSuccess:  () => qc.invalidateQueries({ queryKey: keys.allResources() }),
  })
}

// ── WORKFLOW ───────────────────────────────────────────────

export function useWorkflowNodes(projectId: string) {
  return useQuery({
    queryKey: keys.workflowNodes(projectId),
    queryFn:  () => db.getWorkflowNodes(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateWorkflowNode(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createWorkflowNode,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflowNodes(projectId) }),
  })
}

export function useUpdateWorkflowNode(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { label?: string; type?: string; software?: string | null; notes?: string | null; assigneeId?: string | null; sortOrder?: number } }) =>
      db.updateWorkflowNode(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflowNodes(projectId) }),
  })
}

export function useDeleteWorkflowNode(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteWorkflowNode,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.workflowNodes(projectId) })
      qc.invalidateQueries({ queryKey: keys.workflowEdges(projectId) })
    },
  })
}

export function useWorkflowEdges(projectId: string) {
  return useQuery({
    queryKey: keys.workflowEdges(projectId),
    queryFn:  () => db.getWorkflowEdges(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateWorkflowEdge(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createWorkflowEdge,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflowEdges(projectId) }),
  })
}

export function useUpdateWorkflowEdge(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { format?: string | null; inputFormat?: string | null; outputFormat?: string | null; handoff?: string | null; notes?: string | null } }) =>
      db.updateWorkflowEdge(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflowEdges(projectId) }),
  })
}

export function useDeleteWorkflowEdge(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteWorkflowEdge,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflowEdges(projectId) }),
  })
}

// ── DELIVERABLES ──────────────────────────────────────────

export function useDeliverables(projectId: string) {
  return useQuery({
    queryKey: keys.deliverables(projectId),
    queryFn:  () => db.getDeliverables(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateDeliverable(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createDeliverable,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.deliverables(projectId) }),
  })
}

export function useUpdateDeliverable(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { title?: string; length?: string | null; format?: string | null; aspectRatio?: string | null; resolution?: string | null; colorSpace?: string | null; soundSpecs?: string | null; notes?: string | null; sortOrder?: number } }) =>
      db.updateDeliverable(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.deliverables(projectId) }),
  })
}

export function useDeleteDeliverable(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteDeliverable,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.deliverables(projectId) }),
  })
}

// ── LOCATIONS ──────────────────────────────────────────────

export function useLocations(projectId: string) {
  return useQuery({
    queryKey: keys.locations(projectId),
    queryFn:  () => db.getLocations(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateLocation(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createLocation,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.locations(projectId) }),
  })
}

export function useUpdateLocation(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Parameters<typeof db.updateLocation>[1] }) =>
      db.updateLocation(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.locations(projectId) }),
  })
}

export function useDeleteLocation(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteLocation,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.locations(projectId) }),
  })
}

// ── INVENTORY ─────────────────────────────────────────────

export function useInventoryItems(projectId: string) {
  return useQuery({
    queryKey: keys.inventoryItems(projectId),
    queryFn:  () => db.getInventoryItems(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateInventoryItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.inventoryItems(projectId) }),
  })
}

export function useUpdateInventoryItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Parameters<typeof db.updateInventoryItem>[1] }) =>
      db.updateInventoryItem(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.inventoryItems(projectId) }),
  })
}

export function useDeleteInventoryItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.inventoryItems(projectId) }),
  })
}

// ── SHOOT DAYS ────────────────────────────────────────────

export function useShootDays(projectId: string) {
  return useQuery({
    queryKey: keys.shootDays(projectId),
    queryFn:  () => db.getShootDays(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateShootDay(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createShootDay,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.shootDays(projectId) }),
  })
}

export function useUpdateShootDay(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Parameters<typeof db.updateShootDay>[1] }) =>
      db.updateShootDay(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.shootDays(projectId) }),
  })
}

export function useDeleteShootDay(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteShootDay,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.shootDays(projectId) }),
  })
}

// ── BUDGET ─────────────────────────────────────────────────

// Single nested query → full budget tree + expenses. Re-fetches when
// shootDays or expenses invalidate the cache.
export function useBudget(projectId: string) {
  return useQuery({
    queryKey: keys.budget(projectId),
    queryFn:  () => db.getBudgetByProject(projectId),
    enabled:  !!projectId,
  })
}

// All budget mutations invalidate the same cache key. Page rollup
// recomputes from the fresh tree on next fetch.
function invalidateBudget(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  qc.invalidateQueries({ queryKey: keys.budget(projectId) })
}

export function useUpdateBudgetLine(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof db.updateBudgetLine>[1] }) =>
      db.updateBudgetLine(id, patch),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useUpdateBudgetLineAmount(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof db.updateBudgetLineAmount>[1] }) =>
      db.updateBudgetLineAmount(id, patch),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useCreateBudgetLine(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createBudgetLine,
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useCreateManualExpense(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createManualExpense,
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useUpdateBudgetVersion(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof db.updateBudgetVersion>[1] }) =>
      db.updateBudgetVersion(id, patch),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useDuplicateBudgetVersion(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ srcVersionId, name }: { srcVersionId: string; name: string }) =>
      db.duplicateBudgetVersion(srcVersionId, name),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useDeleteBudgetVersion(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteBudgetVersion(id),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

// PR 11 — budget creation flows. Each mutation invalidates the target
// project's budget cache so the page flips from empty-state to live
// budget without a manual refetch. The clone flow also invalidates the
// projects-with-budgets list so a producer cloning rapidly across
// projects sees up-to-date source options.
export function useCreateBudgetFromTemplate(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createBudgetFromTemplate,
    onSuccess:  () => invalidateBudget(qc, projectId),
  })
}

export function useCreateBlankBudget(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createBlankBudget,
    onSuccess:  () => invalidateBudget(qc, projectId),
  })
}

export function useCreateBudgetByClone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createBudgetByClone,
    onSuccess:  () => {
      invalidateBudget(qc, projectId)
      qc.invalidateQueries({ queryKey: keys.projectsWithBudgets() })
    },
  })
}

export function useProjectsWithBudgets() {
  return useQuery({
    queryKey: keys.projectsWithBudgets(),
    queryFn:  () => db.getProjectsWithBudgets(),
  })
}

// PR 12 — settings sheet mutations.
export function useUpdateBudget(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof db.updateBudget>[1] }) =>
      db.updateBudget(id, patch),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useDeleteBudget(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteBudget(id),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useCreateBudgetMarkup(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createBudgetMarkup,
    onSuccess:  () => invalidateBudget(qc, projectId),
  })
}

export function useUpdateBudgetMarkup(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof db.updateBudgetMarkup>[1] }) =>
      db.updateBudgetMarkup(id, patch),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

export function useDeleteBudgetMarkup(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteBudgetMarkup(id),
    onSuccess: () => invalidateBudget(qc, projectId),
  })
}

// ── CASTING ────────────────────────────────────────────────

export function useCastRoles(projectId: string) {
  return useQuery({
    queryKey: keys.castRoles(projectId),
    queryFn:  () => db.getCastRoles(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateCastRole(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createCastRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.castRoles(projectId) }),
  })
}

export function useUpdateCastEntity(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; description?: string | null; metadata?: Record<string, any> | null } }) =>
      db.updateCastRole(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.castRoles(projectId) }),
  })
}

export function useUpdateTalent(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Parameters<typeof db.updateTalent>[1] }) =>
      db.updateTalent(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.castRoles(projectId) }),
  })
}

export function useAssignTalent(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.assignTalentToRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.castRoles(projectId) }),
  })
}

export function useDeleteCastRole(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteCastRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.castRoles(projectId) }),
  })
}

// ── ART ────────────────────────────────────────────────────

export function useArtItems(projectId: string) {
  return useQuery({
    queryKey: keys.artItems(projectId),
    queryFn:  () => db.getArtItems(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateArtItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createArtItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.artItems(projectId) }),
  })
}

export function useUpdateArtItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string; description?: string | null; metadata?: Record<string, any> | null } }) =>
      db.updateArtItem(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.artItems(projectId) }),
  })
}

export function useDeleteArtItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteArtItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.artItems(projectId) }),
  })
}

// PropSourced / WardrobeSourced upserts — invalidate the art-items query
// so a status change re-renders pills + filter counts immediately.
export function useUpsertPropSourced(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, fields }: {
      entityId: string
      fields: { status?: 'needed' | 'sourced' | 'ready'; isHero?: boolean }
    }) => db.upsertPropSourced(entityId, projectId, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.artItems(projectId) }),
  })
}

export function useUpsertWardrobeSourced(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, fields }: {
      entityId: string
      fields: { status?: 'needed' | 'sourced' | 'fitted' | 'ready' }
    }) => db.upsertWardrobeSourced(entityId, projectId, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.artItems(projectId) }),
  })
}

// ── MOODBOARD ──────────────────────────────────────────────

export function useMoodboardTabs(projectId: string) {
  return useQuery({
    queryKey: keys.moodboardTabs(projectId),
    queryFn:  () => db.getMoodboardTabs(projectId),
    enabled:  !!projectId,
  })
}


export function useCreateMoodboardTab(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createMoodboardTab,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.moodboardTabs(projectId) }),
  })
}

export function useUpdateMoodboardTab(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string; sortOrder?: number } }) =>
      db.updateMoodboardTab(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.moodboardTabs(projectId) }),
  })
}

export function useDeleteMoodboardTab(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteMoodboardTab,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.moodboardTabs(projectId) })
      qc.invalidateQueries({ queryKey: keys.moodboard(projectId) })
    },
  })
}

export function useMoodboard(projectId: string) {
  return useQuery({
    queryKey: keys.moodboard(projectId),
    queryFn:  () => db.getMoodboardRefs(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateMoodboardRef(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createMoodboardRef,
    onSuccess:  () => qc.invalidateQueries({ queryKey: keys.moodboard(projectId) }),
  })
}

export function useUpdateMoodboardRef(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Parameters<typeof db.updateMoodboardRef>[1] }) =>
      db.updateMoodboardRef(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.moodboard(projectId) }),
  })
}

export function useDeleteMoodboardRef(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteMoodboardRef,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.moodboard(projectId) }),
  })
}

export function useReorderMoodboardRefs(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.reorderMoodboardRefs,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.moodboard(projectId) }),
  })
}

// ── GLOBAL QUERIES (cross-project) ────────────────────────

export function useAllActionItems() {
  return useQuery({
    queryKey: keys.allActionItems(),
    queryFn: db.getAllActionItems,
  })
}

export function useAllMilestones() {
  return useQuery({
    queryKey: keys.allMilestones(),
    queryFn: db.getAllMilestones,
  })
}

export function useAllThreads() {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.allThreads(meId),
    queryFn: () => db.getAllThreads(meId),
  })
}

export function useAllChats() {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.allChats(meId),
    queryFn: () => db.getAllChats(meId),
  })
}

// ── CHAT ──────────────────────────────────────────────────

export function useChatChannels(projectId: string) {
  return useQuery({
    queryKey: keys.chatChannels(projectId),
    queryFn:  () => db.getChatChannels(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateChatChannel(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createChatChannel,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chatChannels(projectId) }),
  })
}

export function useChannelMessages(channelId: string | null) {
  return useQuery({
    queryKey: keys.chatMessages(channelId ?? ''),
    queryFn:  () => db.getChannelMessages(channelId as string),
    enabled:  !!channelId,
  })
}

export function useDMMessages(projectId: string, meId: string | null, partnerId: string | null) {
  return useQuery({
    queryKey: keys.dmMessages(projectId, meId ?? '', partnerId ?? ''),
    queryFn:  () => db.getDMMessages(projectId, meId as string, partnerId as string),
    enabled:  !!meId && !!partnerId,
  })
}

export function useDMList(projectId: string, meId: string | null) {
  return useQuery({
    queryKey: keys.dmList(projectId, meId ?? ''),
    queryFn:  () => db.getDMList(projectId, meId as string),
    enabled:  !!meId,
  })
}

export function useSendChatMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.sendChatMessage,
    onSuccess: (_data, vars) => {
      if (vars.channelId) {
        qc.invalidateQueries({ queryKey: keys.chatMessages(vars.channelId) })
      } else if (vars.recipientId) {
        qc.invalidateQueries({ queryKey: keys.dmMessages(projectId, vars.senderId, vars.recipientId) })
        qc.invalidateQueries({ queryKey: keys.dmList(projectId, vars.senderId) })
      }
    },
  })
}

/** Subscribe to new messages for a channel (or null for all DMs in a project). */
export function useChatSubscription(
  filter: { projectId: string; channelId: string | null; meId?: string | null; partnerId?: string | null },
) {
  const qc = useQueryClient()
  useEffect(() => {
    const unsub = db.subscribeToChatMessages(
      { channelId: filter.channelId, projectId: filter.projectId },
      (msg) => {
        if (filter.channelId) {
          qc.invalidateQueries({ queryKey: keys.chatMessages(filter.channelId) })
          return
        }
        // DM
        if (!filter.meId) return
        qc.invalidateQueries({ queryKey: keys.dmList(filter.projectId, filter.meId) })
        if (filter.partnerId) {
          qc.invalidateQueries({ queryKey: keys.dmMessages(filter.projectId, filter.meId, filter.partnerId) })
        }
      },
    )
    return unsub
  }, [filter.projectId, filter.channelId, filter.meId, filter.partnerId, qc])
}

// ── PROJECT-SELECTION FOLDERS ─────────────────────────────

export function useUserProjectFolders() {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.userProjectFolders(meId),
    queryFn:  () => db.getUserProjectFolders(meId),
    enabled:  !!meId,
  })
}

export function useUserProjectPlacements() {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.userProjectPlacements(meId),
    queryFn:  () => db.getUserProjectPlacements(meId),
    enabled:  !!meId,
  })
}

export function useArchivedUserProjectFolders() {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.archivedUserProjectFolders(meId),
    queryFn:  () => db.getArchivedUserProjectFolders(meId),
    enabled:  !!meId,
  })
}

function invalidateFolders(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['userProjectFolders'] })
  qc.invalidateQueries({ queryKey: ['archivedUserProjectFolders'] })
  qc.invalidateQueries({ queryKey: ['userProjectPlacements'] })
}

export function useArchiveUserProjectFolder() {
  const qc = useQueryClient()
  const meId = useMeId()
  return useMutation({
    mutationFn: (folderId: string) => db.archiveUserProjectFolder(meId!, folderId),
    onSuccess: () => {
      invalidateFolders(qc)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['archivedProjects'] })
    },
  })
}

export function useRestoreUserProjectFolder() {
  const qc = useQueryClient()
  const meId = useMeId()
  return useMutation({
    mutationFn: (folderId: string) => db.restoreUserProjectFolder(meId!, folderId),
    onSuccess: () => {
      invalidateFolders(qc)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['archivedProjects'] })
    },
  })
}

export function useCreateUserProjectFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createUserProjectFolder,
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useUpdateUserProjectFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string; color?: string | null; sortOrder?: number } }) =>
      db.updateUserProjectFolder(id, fields),
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useDeleteUserProjectFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteUserProjectFolder,
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useUpsertUserProjectPlacement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.upsertUserProjectPlacement,
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useMoveProjectToRoot() {
  const qc = useQueryClient()
  const meId = useMeId()
  return useMutation({
    mutationFn: (projectId: string) => db.moveProjectToRoot({ userId: meId!, projectId }),
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useBulkReorderHomeGrid() {
  const qc = useQueryClient()
  const meId = useMeId()
  return useMutation({
    mutationFn: (items: { type: 'folder' | 'project'; id: string; sortOrder: number }[]) =>
      db.bulkReorderHomeGrid(meId!, items),
    onSuccess:  () => invalidateFolders(qc),
  })
}
