import { createBrowserAuthClient as createClient } from '@origin-one/auth'

// ── STORAGE ───────────────────────────────────────────────

export async function uploadMoodboardImage(file: File, projectId: string): Promise<string> {
  const db = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await db.storage.from('moodboard').upload(path, file, { upsert: true })
  if (error) {
    console.error('uploadMoodboardImage failed:', error)
    if (error.message?.includes('Bucket not found')) {
      throw new Error('Storage bucket not configured. Run the setup-storage.sql script in the Supabase SQL Editor.')
    }
    if (error.message?.includes('mime type')) {
      throw new Error('File type not supported. Use PNG, JPEG, or WebP.')
    }
    if (error.message?.includes('size')) {
      throw new Error('File too large. Maximum 10 MB.')
    }
    throw new Error(error.message || 'Upload failed. Please try again.')
  }

  const { data } = db.storage.from('moodboard').getPublicUrl(path)
  return data.publicUrl
}

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
  project: { id?: string; name: string; teamId?: string; status?: string; color?: string; client?: string; type?: string }
) {
  const db = createClient()

  // Resolve teamId — use provided value, or look up the first team
  let teamId = project.teamId
  if (!teamId) {
    const { data: team } = await db.from('Team').select('id').limit(1).single()
    teamId = team?.id
  }
  if (!teamId) throw new Error('No team found — cannot create project')

  const { data, error } = await db
    .from('Project')
    .insert({
      id: project.id || crypto.randomUUID(),
      name: project.name,
      teamId,
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
  fields: { name?: string; status?: string; color?: string; client?: string; type?: string; aspectRatio?: string }
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
    .insert({ id: crypto.randomUUID(), projectId: folder.projectId, name: folder.name })
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

// ── CREW (ProjectMember + User) ───────────────────────────

export async function getAllCrew() {
  const db = createClient()
  const { data, error } = await db
    .from('ProjectMember')
    .select('*, User(*)')
    .order('createdAt', { ascending: true })
  if (error) throw error
  return data
}

export async function getCrew(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('ProjectMember')
    .select('*, User(*)')
    .eq('projectId', projectId)
    .order('createdAt', { ascending: true })
  if (error) throw error
  return data
}

export async function addCrewMember(
  member: { projectId: string; userId: string; role: string }
) {
  const db = createClient()
  const { data, error } = await db
    .from('ProjectMember')
    .insert({
      id: crypto.randomUUID(),
      projectId: member.projectId,
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
  const { error } = await db.from('ProjectMember').delete().eq('id', id)
  if (error) { console.error('removeCrewMember failed:', error); throw error }
}

export async function updateCrewMember(
  id: string,
  fields: { role?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('ProjectMember').update(fields).eq('id', id)
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

export async function updateActionItem(
  id: string,
  fields: { title?: string; description?: string; assignedTo?: string | null; department?: string | null; dueDate?: string | null; status?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('ActionItem')
    .update(fields)
    .eq('id', id)
  if (error) { console.error('updateActionItem failed:', error); throw error }
}

export async function createActionItem(
  item: { projectId: string; title: string; description?: string; assignedTo?: string | null; department?: string | null; dueDate?: string | null }
) {
  const db = createClient()
  const { data, error } = await db
    .from('ActionItem')
    .insert({
      id: crypto.randomUUID(),
      projectId: item.projectId,
      title: item.title,
      description: item.description ?? null,
      assignedTo: item.assignedTo ?? null,
      department: item.department ?? null,
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

export async function updateMilestone(
  id: string,
  fields: { title?: string; date?: string; status?: string; notes?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Milestone')
    .update(fields)
    .eq('id', id)
  if (error) { console.error('updateMilestone failed:', error); throw error }
}

export async function addMilestonePerson(milestoneId: string, userId: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('MilestonePerson').insert({ id: crypto.randomUUID(), milestoneId, userId })
  if (error) { console.error('addMilestonePerson failed:', error); throw error }
}

export async function removeMilestonePerson(milestoneId: string, userId: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('MilestonePerson').delete().eq('milestoneId', milestoneId).eq('userId', userId)
  if (error) { console.error('removeMilestonePerson failed:', error); throw error }
}

export async function createMilestone(
  milestone: { projectId: string; title: string; date: string; status?: string; notes?: string; people?: string[] }
) {
  const db = createClient()
  const { people = [], ...fields } = milestone
  const { data, error } = await db
    .from('Milestone')
    .insert({
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
    .insert({ id: crypto.randomUUID(), projectId, title, createdBy })
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
    .insert({ id: crypto.randomUUID(), threadId, createdBy, content })
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
      id: crypto.randomUUID(),
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

export async function getSceneMakerVersions(_projectId: string): Promise<any[]> { return [] }
export async function getSMScenes(_versionId: string): Promise<any[]> { return [] }
export async function getSMShots(_versionId: string): Promise<any[]> { return [] }
export async function updateShotImages(_shotId: string, _images: string[]) {}
// ── MOODBOARD TABS ────────────────────────────────────────

export async function getMoodboardTabs(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('MoodboardTab')
    .select('*')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
  if (error) { console.error('getMoodboardTabs failed:', error); return [] }
  return data ?? []
}

export async function createMoodboardTab(tab: { projectId: string; name: string; sortOrder?: number }) {
  const db = createClient()
  const { data, error } = await db
    .from('MoodboardTab')
    .insert({ id: crypto.randomUUID(), projectId: tab.projectId, name: tab.name, sortOrder: tab.sortOrder ?? 0 })
    .select()
    .single()
  if (error) { throw new Error(`Create tab failed: ${error.message}`) }
  return data
}

export async function updateMoodboardTab(id: string, fields: { name?: string; sortOrder?: number }) {
  const db = createClient()
  const { error } = await db.from('MoodboardTab').update(fields).eq('id', id)
  if (error) { throw new Error(`Update tab failed: ${error.message}`) }
}

export async function deleteMoodboardTab(id: string) {
  const db = createClient()
  // Unlink refs from this tab first
  await db.from('MoodboardRef').update({ tabId: null }).eq('tabId', id)
  const { error } = await db.from('MoodboardTab').delete().eq('id', id)
  if (error) { throw new Error(`Delete tab failed: ${error.message}`) }
}

// ── MOODBOARD REFS ────────────────────────────────────────

export async function getMoodboardRefs(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('MoodboardRef')
    .select('*')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
  if (error) { console.error('getMoodboardRefs failed:', error); return [] }
  return data ?? []
}

export async function createMoodboardRef(
  ref: { projectId: string; cat: string; title: string; note?: string; imageUrl?: string | null; gradient?: string | null; sortOrder?: number; tabId?: string | null }
) {
  const db = createClient()
  const payload = {
    id: crypto.randomUUID(),
    projectId: ref.projectId,
    cat: ref.cat,
    title: ref.title,
    note: ref.note ?? null,
    imageUrl: ref.imageUrl ?? null,
    gradient: ref.gradient ?? null,
    sortOrder: ref.sortOrder ?? 0,
    tabId: ref.tabId ?? null,
  }
  console.log('[createMoodboardRef] inserting:', payload)
  const { data, error } = await db
    .from('MoodboardRef')
    .insert(payload)
    .select()
    .single()
  if (error) {
    console.error('[createMoodboardRef] FAILED:', error.code, error.message, error.details, error.hint)
    throw new Error(`DB write failed: ${error.message}`)
  }
  console.log('[createMoodboardRef] success:', data?.id)
  return data
}

export async function updateMoodboardRef(
  id: string,
  fields: { title?: string; note?: string | null; imageUrl?: string | null; cat?: string; sortOrder?: number; tabId?: string | null }
) {
  const db = createClient()
  const { error } = await db.from('MoodboardRef').update(fields).eq('id', id)
  if (error) { throw new Error(`Update ref failed: ${error.message}`) }
}

export async function deleteMoodboardRef(id: string) {
  const db = createClient()
  // Get the ref first to clean up storage
  const { data: ref } = await db.from('MoodboardRef').select('imageUrl').eq('id', id).single()
  if (ref?.imageUrl) {
    // Extract path from public URL: ...storage/v1/object/public/moodboard/{path}
    const match = ref.imageUrl.match(/\/moodboard\/(.+)$/)
    if (match) {
      await db.storage.from('moodboard').remove([match[1]])
    }
  }
  const { error } = await db.from('MoodboardRef').delete().eq('id', id)
  if (error) { throw new Error(`Delete ref failed: ${error.message}`) }
}

export async function reorderMoodboardRefs(updates: { id: string; sortOrder: number }[]) {
  const db = createClient()
  // Batch update sort orders
  for (const u of updates) {
    await db.from('MoodboardRef').update({ sortOrder: u.sortOrder }).eq('id', u.id)
  }
}
// ── LOCATIONS ─────────────────────────────────────────────

export async function getLocations(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Location')
    .select('*')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return data
}

export async function createLocation(
  loc: { projectId: string; name: string; description?: string; address?: string; keyContact?: string; webLink?: string; shootDates?: string; status?: string; approved?: boolean; notes?: string; imageUrl?: string | null; sceneTab?: string | null; sortOrder?: number }
) {
  const db = createClient()
  const { data, error } = await db
    .from('Location')
    .insert({
      id: crypto.randomUUID(),
      projectId: loc.projectId,
      name: loc.name,
      description: loc.description ?? null,
      address: loc.address ?? null,
      keyContact: loc.keyContact ?? null,
      webLink: loc.webLink ?? null,
      shootDates: loc.shootDates ?? null,
      status: loc.status ?? 'no_contact',
      approved: loc.approved ?? false,
      notes: loc.notes ?? null,
      imageUrl: loc.imageUrl ?? null,
      sceneTab: loc.sceneTab ?? null,
      sortOrder: loc.sortOrder ?? 0,
    })
    .select()
    .single()
  if (error) { console.error('createLocation failed:', error); throw error }
  return data
}

export async function updateLocation(
  id: string,
  fields: { name?: string; description?: string | null; address?: string | null; keyContact?: string | null; webLink?: string | null; shootDates?: string | null; status?: string; approved?: boolean; notes?: string | null; imageUrl?: string | null; sceneTab?: string | null; sortOrder?: number }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Location')
    .update(fields)
    .eq('id', id)
  if (error) { console.error('updateLocation failed:', error); throw error }
}

export async function deleteLocation(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Location').delete().eq('id', id)
  if (error) { console.error('deleteLocation failed:', error); throw error }
}
export async function getCastRoles(_projectId: string): Promise<any[]> { return [] }
export async function updateCastRole(_id: string, _updates: any) {}
export async function getArtItems(_projectId: string): Promise<any[]> { return [] }
export async function getWorkflowNodes(_projectId: string): Promise<any[]> { return [] }
export async function updateProjectOrder(_projectId: string, _fields: any) {}
