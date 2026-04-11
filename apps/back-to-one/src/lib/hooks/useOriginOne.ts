import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as db from '@/lib/db/queries'

// ── QUERY KEYS — one place, no magic strings ───────────────

export const keys = {
  folders:            () => ['folders'] as const,
  projects:           () => ['projects'] as const,
  project:            (id: string) => ['projects', id] as const,
  crew:               (projectId: string) => ['crew', projectId] as const,
  actionItems:        (projectId: string) => ['actionItems', projectId] as const,
  milestones:         (projectId: string) => ['milestones', projectId] as const,
  allActionItems:     () => ['allActionItems'] as const,
  allMilestones:      () => ['allMilestones'] as const,
  allThreads:         () => ['allThreads'] as const,
  smVersions:     (projectId: string) => ['smVersions', projectId] as const,
  smScenes:       (versionId: string) => ['smScenes', versionId] as const,
  smShots:        (versionId: string) => ['smShots', versionId] as const,
  moodboard:      (projectId: string) => ['moodboard', projectId] as const,
  locations:      (projectId: string) => ['locations', projectId] as const,
  castRoles:      (projectId: string) => ['castRoles', projectId] as const,
  artItems:       (projectId: string) => ['artItems', projectId] as const,
  threads:        (projectId: string) => ['threads', projectId] as const,
  resources:      (projectId: string) => ['resources', projectId] as const,
  workflowNodes:  (projectId: string) => ['workflowNodes', projectId] as const,
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
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string; client?: string; accent_color?: string; folder_id?: string | null; display_order?: number } }) =>
      db.updateProject(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects() }),
  })
}

// ── FOLDERS ───────────────────────────────────────────────

export function useFolders() {
  return useQuery({
    queryKey: keys.folders(),
    queryFn:  db.getFolders,
  })
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createFolder,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.folders() }),
    onError: (err) => console.error('useCreateFolder failed:', err),
  })
}

export function useUpdateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string; color?: string; logo_url?: string | null; order?: number } }) =>
      db.updateFolder(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.folders() }),
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.folders() })
      qc.invalidateQueries({ queryKey: keys.projects() })
    },
  })
}

export function useUpdateProjectOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { display_order?: number; folder_id?: string | null } }) =>
      db.updateProjectOrder(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects() }),
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
    mutationFn: ({ id, fields }: { id: string; fields: Parameters<typeof db.updateCrewMember>[1] }) =>
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
    // Optimistic update — check/uncheck feels instant
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: keys.actionItems(projectId) })
      const prev = qc.getQueryData(keys.actionItems(projectId))
      qc.setQueryData(keys.actionItems(projectId), (old: any[]) =>
        old?.map(item => item.id === id ? { ...item, done } : item)
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

// ── SCENEMAKER ─────────────────────────────────────────────

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
    mutationFn: ({ subject }: { subject: string }) =>
      db.createThread(projectId, subject),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.threads(projectId) }),
  })
}

export function usePostMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      threadId,
      authorId,
      tagged,
      text,
    }: {
      threadId: string
      authorId: string
      tagged: string[]
      text: string
    }) => db.postMessage(threadId, authorId, tagged, text),
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

// ── LOCATIONS ──────────────────────────────────────────────

export function useLocations(projectId: string) {
  return useQuery({
    queryKey: keys.locations(projectId),
    queryFn:  () => db.getLocationGroups(projectId),
    enabled:  !!projectId,
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

// ── ART ────────────────────────────────────────────────────

export function useArtItems(projectId: string) {
  return useQuery({
    queryKey: keys.artItems(projectId),
    queryFn:  () => db.getArtItems(projectId),
    enabled:  !!projectId,
  })
}

// ── MOODBOARD ──────────────────────────────────────────────

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

export function useUpdateLocationStatus(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ optionId, status }: { optionId: string; status: string }) =>
      db.updateLocationStatus(optionId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.locations(projectId) }),
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
