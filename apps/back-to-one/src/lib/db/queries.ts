import { createBrowserAuthClient as createClient } from '@origin-one/auth'

// ── PROJECTS ───────────────────────────────────────────────

export async function getProjects() {
  const db = createClient()
  const { data, error } = await db
    .from('Project')
    .select('*')
    .neq('status', 'archived')
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data
}

export async function archiveProject(projectId: string): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Project')
    .update({ status: 'archived' })
    .eq('id', projectId)
  if (error) { console.error('archiveProject failed:', error); throw error }
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Project')
    .delete()
    .eq('id', projectId)
  if (error) { console.error('deleteProject failed:', error); throw error }
}

export async function getProject(id: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Project')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProject(
  project: { name: string; teamId: string; status?: string; color?: string; client?: string; type?: string }
) {
  const db = createClient()
  const { data, error } = await db
    .from('Project')
    .insert({
      name: project.name,
      teamId: project.teamId,
      status: project.status ?? 'development',
      color: project.color ?? null,
      client: project.client ?? null,
      type: project.type ?? null,
    })
    .select()
    .single()
  if (error) { console.error('createProject failed:', error); throw error }
  return data
}

export async function updateProject(
  projectId: string,
  fields: { name?: string; status?: string; color?: string; client?: string; type?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Project')
    .update(fields)
    .eq('id', projectId)
  if (error) { console.error('updateProject failed:', error); throw error }
}

// ── FOLDERS ───────────────────────────────────────────────

export async function getFolders(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Folder')
    .select('*')
    .eq('projectId', projectId)
    .order('name', { ascending: true })
  if (error) {
    console.warn('getFolders failed:', error.message)
    return []
  }
  return data
}

export async function createFolder(
  folder: { projectId: string; name: string }
) {
  const db = createClient()
  const { data, error } = await db
    .from('Folder')
    .insert({ projectId: folder.projectId, name: folder.name })
    .select()
    .single()
  if (error) { console.error('createFolder failed:', error); throw error }
  return data
}

export async function updateFolder(
  folderId: string,
  fields: { name?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Folder')
    .update(fields)
    .eq('id', folderId)
  if (error) { console.error('updateFolder failed:', error); throw error }
}

export async function deleteFolder(folderId: string): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Folder')
    .delete()
    .eq('id', folderId)
  if (error) { console.error('deleteFolder failed:', error); throw error }
}

// ── CREW (User + TeamMember) ──────────────────────────────

export async function getAllCrew() {
  const db = createClient()
  const { data, error } = await db
    .from('TeamMember')
    .select('*, User(*)')
    .order('createdAt', { ascending: true })
  if (error) throw error
  return data
}

export async function getCrew(teamId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('TeamMember')
    .select('*, User(*)')
    .eq('teamId', teamId)
    .order('createdAt', { ascending: true })
  if (error) throw error
  return data
}

export async function addCrewMember(
  member: { teamId: string; userId: string; role: string }
) {
  const db = createClient()
  const { data, error } = await db
    .from('TeamMember')
    .insert({
      teamId: member.teamId,
      userId: member.userId,
      role: member.role,
    })
    .select('*, User(*)')
    .single()
  if (error) { console.error('addCrewMember failed:', error); throw error }
  return data
}

export async function removeCrewMember(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('TeamMember').delete().eq('id', id)
  if (error) { console.error('removeCrewMember failed:', error); throw error }
}

export async function updateCrewMember(
  id: string,
  fields: { role?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('TeamMember').update(fields).eq('id', id)
  if (error) { console.error('updateCrewMember failed:', error); throw error }
}

// ── ACTION ITEMS ───────────────────────────────────────────

export async function getActionItems(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('ActionItem')
    .select('*')
    .eq('projectId', projectId)
    .order('dueDate', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

export async function toggleActionItem(id: string, done: boolean): Promise<void> {
  const db = createClient()
  const status = done ? 'done' : 'open'
  const { error } = await db
    .from('ActionItem')
    .update({ status })
    .eq('id', id)
  if (error) { console.error('toggleActionItem failed:', error); throw error }
}

export async function createActionItem(
  item: { projectId: string; title: string; description?: string; assignedTo?: string | null; dueDate?: string | null }
) {
  const db = createClient()
  const { data, error } = await db
    .from('ActionItem')
    .insert({
      projectId: item.projectId,
      title: item.title,
      description: item.description ?? null,
      assignedTo: item.assignedTo ?? null,
      dueDate: item.dueDate ?? null,
    })
    .select()
    .single()
  if (error) { console.error('createActionItem failed:', error); throw error }
  return data
}

// ── MILESTONES ─────────────────────────────────────────────

export async function getMilestones(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Milestone')
    .select('*, MilestonePerson(userId)')
    .eq('projectId', projectId)
    .order('date', { ascending: true })
  if (error) throw error
  return data.map((m: any) => ({
    ...m,
    people: (m.MilestonePerson ?? []).map((p: { userId: string }) => p.userId),
  }))
}

export async function createMilestone(
  milestone: { projectId: string; title: string; date: string; status?: string; notes?: string; people?: string[] }
) {
  const db = createClient()
  const { people = [], ...fields } = milestone
  const { data, error } = await db
    .from('Milestone')
    .insert({
      projectId: fields.projectId,
      title: fields.title,
      date: fields.date,
      status: fields.status ?? 'upcoming',
      notes: fields.notes ?? null,
    })
    .select()
    .single()
  if (error) { console.error('createMilestone failed:', error); throw error }
  if (people.length > 0) {
    const { error: pErr } = await db
      .from('MilestonePerson')
      .insert(people.map(userId => ({ milestoneId: data.id, userId })))
    if (pErr) { console.error('createMilestone people failed:', pErr); throw pErr }
  }
  return { ...data, people }
}

// ── SCENES (was sm_scenes) ────────────────────────────────

export async function getScenes(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Scene')
    .select('*')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return data
}

// ── SHOTS (was sm_shots) ──────────────────────────────────

export async function getShots(sceneId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Shot')
    .select('*')
    .eq('sceneId', sceneId)
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return data
}

export async function getShotsByProject(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Scene')
    .select('*, Shot(*)')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return data
}

export async function updateShotOrder(
  shotId: string,
  fields: { sortOrder?: number; sceneId?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Shot')
    .update(fields)
    .eq('id', shotId)
  if (error) throw error
}

export async function createShot(shot: {
  sceneId: string
  shotNumber: string
  size?: string | null
  description?: string
  status?: string
  sortOrder: number
}) {
  const db = createClient()
  const { data, error } = await db
    .from('Shot')
    .insert({
      sceneId: shot.sceneId,
      shotNumber: shot.shotNumber,
      size: shot.size ?? null,
      description: shot.description ?? '',
      status: shot.status ?? 'planned',
      sortOrder: shot.sortOrder,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── THREADS ────────────────────────────────────────────────

export async function getThreads(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Thread')
    .select('*, ThreadMessage(*)')
    .eq('projectId', projectId)
    .order('updatedAt', { ascending: false })
  if (error) throw error
  return data.map((t: any) => ({
    ...t,
    messages: t.ThreadMessage ?? [],
  }))
}

export async function createThread(
  projectId: string,
  title: string,
  createdBy: string,
) {
  const db = createClient()
  const { data, error } = await db
    .from('Thread')
    .insert({ projectId, title, createdBy })
    .select()
    .single()
  if (error) { console.error('createThread failed:', error); throw error }
  return { ...data, messages: [] }
}

export async function postMessage(
  threadId: string,
  createdBy: string,
  content: string,
) {
  const db = createClient()
  const { data, error } = await db
    .from('ThreadMessage')
    .insert({ threadId, createdBy, content })
    .select()
    .single()
  if (error) { console.error('postMessage failed:', error); throw error }
  return data
}

// ── RESOURCES ──────────────────────────────────────────────

export async function getResources(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Resource')
    .select('*')
    .eq('projectId', projectId)
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data
}

export async function createResource(
  resource: { projectId: string; folderId?: string | null; title: string; url: string; type: string; createdBy: string }
) {
  const db = createClient()
  const { data, error } = await db
    .from('Resource')
    .insert({
      projectId: resource.projectId,
      folderId: resource.folderId ?? null,
      title: resource.title,
      url: resource.url,
      type: resource.type,
      createdBy: resource.createdBy,
    })
    .select()
    .single()
  if (error) { console.error('createResource failed:', error); throw error }
  return data
}

// ── GLOBAL QUERIES (cross-project) ────────────────────────

export async function getAllActionItems() {
  const db = createClient()
  const { data, error } = await db
    .from('ActionItem')
    .select('*')
    .order('dueDate', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

export async function getAllMilestones() {
  const db = createClient()
  const { data, error } = await db
    .from('Milestone')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return data
}

export async function getAllThreads() {
  const db = createClient()
  const { data, error } = await db
    .from('Thread')
    .select('*, ThreadMessage(*)')
    .order('updatedAt', { ascending: false })
  if (error) throw error
  return data.map((t: any) => ({
    ...t,
    messages: t.ThreadMessage ?? [],
  }))
}

// ── NOT YET IN SCHEMA (stubs) ─────────────────────────────
// These tables were removed from the old schema and have no
// equivalent in the new Prisma schema yet. Functions return
// empty data so consuming code doesn't crash.

export async function getSceneMakerVersions(_projectId: string) { return [] }
export async function getSMScenes(_versionId: string) { return [] }
export async function getSMShots(_versionId: string) { return [] }
export async function updateShotImages(_shotId: string, _images: string[]) {}
export async function getMoodboardRefs(_projectId: string) { return [] }
export async function createMoodboardRef(_ref: any) { return _ref }
export async function getLocationGroups(_projectId: string) { return [] }
export async function updateLocationStatus(_optionId: string, _status: string) {}
export async function getCastRoles(_projectId: string) { return [] }
export async function updateCastRole(_id: string, _updates: any) {}
export async function getArtItems(_projectId: string) { return [] }
export async function getWorkflowNodes(_projectId: string) { return [] }
export async function updateProjectOrder(_projectId: string, _fields: any) {}
