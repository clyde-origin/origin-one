import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as db from '@/lib/db/queries'

// ── QUERY KEYS — one place, no magic strings ───────────────

export const keys = {
  projects:           () => ['projects'] as const,
  project:            (id: string) => ['projects', id] as const,
  crew:               (teamId: string) => ['crew', teamId] as const,
  actionItems:        (projectId: string) => ['actionItems', projectId] as const,
  milestones:         (projectId: string) => ['milestones', projectId] as const,
  allActionItems:     () => ['allActionItems'] as const,
  allMilestones:      () => ['allMilestones'] as const,
  allThreads:         () => ['allThreads'] as const,
  shotlistVersions: (projectId: string) => ['shotlistVersions', projectId] as const,
  smVersions:     (projectId: string) => ['smVersions', projectId] as const,
  smScenes:       (versionId: string) => ['smScenes', versionId] as const,
  smShots:        (versionId: string) => ['smShots', versionId] as const,
  scenes:         (projectId: string) => ['scenes', projectId] as const,
  shots:          (sceneId: string) => ['shots', sceneId] as const,
  moodboard:      (projectId: string) => ['moodboard', projectId] as const,
  locations:      (projectId: string) => ['locations', projectId] as const,
  castRoles:      (projectId: string) => ['castRoles', projectId] as const,
  artItems:       (projectId: string) => ['artItems', projectId] as const,
  threads:        (projectId: string) => ['threads', projectId] as const,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects() }),
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

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createFolder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  })
}

export function useUpdateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string } }) =>
      db.updateFolder(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] })
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

// ── SCENEMAKER (stubs) ────────────────────────────────────

export function useSMVersions(projectId: string) {
  return useQuery({
    queryKey: keys.smVersions(projectId),
    queryFn:  () => db.getSceneMakerVersions(projectId),
    enabled:  !!projectId,
  })
}

export function useSMScenes(versionId: string) {
  return useQuery({
    queryKey: keys.smScenes(versionId),
    queryFn:  () => db.getSMScenes(versionId),
    enabled:  !!versionId,
  })
}

export function useSMShots(versionId: string) {
  return useQuery({
    queryKey: keys.smShots(versionId),
    queryFn:  () => db.getSMShots(versionId),
    enabled:  !!versionId,
  })
}

export function useCreateShot(versionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shot: Parameters<typeof db.createShot>[0]) => db.createShot(shot),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.smShots(versionId) }) },
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

export function useThreads(projectId: string) {
  return useQuery({
    queryKey: keys.threads(projectId),
    queryFn:  () => db.getThreads(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateThread(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ title, createdBy }: { title: string; createdBy?: string }) =>
      db.createThread(projectId, title, createdBy ?? ''),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.threads(projectId) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.threads(projectId) }),
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

// ── MOODBOARD ──────────────────────────────────────────────

export function useMoodboardTabs(projectId: string) {
  return useQuery({
    queryKey: ['moodboardTabs', projectId],
    queryFn:  () => db.getMoodboardTabs(projectId),
    enabled:  !!projectId,
  })
}

export function useCreateMoodboardTab(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createMoodboardTab,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['moodboardTabs', projectId] }),
  })
}

export function useUpdateMoodboardTab(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string; sortOrder?: number } }) =>
      db.updateMoodboardTab(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['moodboardTabs', projectId] }),
  })
}

export function useDeleteMoodboardTab(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteMoodboardTab,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moodboardTabs', projectId] })
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
  return useQuery({
    queryKey: keys.allThreads(),
    queryFn: db.getAllThreads,
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
    queryKey: channelId ? keys.chatMessages(channelId) : ['chatMessages', 'none'],
    queryFn:  () => channelId ? db.getChannelMessages(channelId) : Promise.resolve([]),
    enabled:  !!channelId,
  })
}

export function useDMMessages(projectId: string, meId: string | null, partnerId: string | null) {
  return useQuery({
    queryKey: meId && partnerId ? keys.dmMessages(projectId, meId, partnerId) : ['dmMessages', 'none'],
    queryFn:  () => meId && partnerId ? db.getDMMessages(projectId, meId, partnerId) : Promise.resolve([]),
    enabled:  !!meId && !!partnerId,
  })
}

export function useDMList(projectId: string, meId: string | null) {
  return useQuery({
    queryKey: meId ? keys.dmList(projectId, meId) : ['dmList', 'none'],
    queryFn:  () => meId ? db.getDMList(projectId, meId) : Promise.resolve([]),
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
