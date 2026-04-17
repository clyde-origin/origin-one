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
  console.log('[createProject] called with:', JSON.stringify(project))
  const db = createClient()

  // Resolve teamId — use provided value, or look up the first team
  let teamId = project.teamId
  if (!teamId) {
    const { data: team, error: teamErr } = await db.from('Team').select('id').limit(1).single()
    console.log('[createProject] Team lookup:', { team, teamErr })
    if (!team) {
      // No team exists — create one
      console.log('[createProject] No team found, creating default team...')
      const { data: newTeam, error: createTeamErr } = await db
        .from('Team')
        .insert({ id: crypto.randomUUID(), name: 'Origin Point' })
        .select()
        .single()
      console.log('[createProject] Team create result:', { newTeam, createTeamErr })
      if (createTeamErr) {
        console.error('[createProject] Failed to create team:', { message: createTeamErr.message, code: createTeamErr.code, details: createTeamErr.details, hint: createTeamErr.hint })
        throw createTeamErr
      }
      teamId = newTeam?.id
    } else {
      teamId = team.id
    }
  }
  if (!teamId) throw new Error('No team found and could not create one')

  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    name: project.name,
    teamId,
    status: project.status ?? 'development',
    color: project.color ?? null,
    client: project.client ?? null,
    type: project.type ?? null,
    createdAt: now,
    updatedAt: now,
  }
  console.log('[createProject] inserting row:', JSON.stringify(row))

  const { data, error } = await db
    .from('Project')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('[createProject] FAILED:', { message: error.message, code: error.code, details: error.details, hint: error.hint })
    throw error
  }
  console.log('[createProject] SUCCESS:', data)
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
  console.log('[getScenes] fetching for projectId:', projectId)
  const { data, error } = await db
    .from('Scene')
    .select('*')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
  console.log('[getScenes] raw response:', { count: data?.length ?? 0, error, data })
  if (error) throw error
  return data
}

export async function createScene(
  projectId: string,
  fields: { title?: string; description?: string; sceneNumber?: string; sortOrder?: number }
): Promise<{ id: string }> {
  const db = createClient()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const row = {
    id,
    projectId,
    sceneNumber: fields.sceneNumber ?? '1',
    title: fields.title ?? null,
    description: fields.description ?? null,
    sortOrder: fields.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  }
  console.log('[createScene] inserting:', row)
  const { error } = await db.from('Scene').insert(row)
  if (error) { console.error('[createScene] FAILED:', error); throw error }
  return { id }
}

/** Insert a scene after a given sortOrder, shifting subsequent scenes */
export async function createSceneAtPosition(
  projectId: string,
  insertAfterSortOrder: number,
  fields: { title?: string; description?: string }
): Promise<{ id: string }> {
  const db = createClient()
  const now = new Date().toISOString()

  // Fetch all existing scenes to determine numbering + shift
  const { data: existing } = await db
    .from('Scene')
    .select('id, sortOrder')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })

  const newSortOrder = insertAfterSortOrder + 1
  const sceneNumber = String((existing?.length ?? 0) + 1)

  // Shift scenes at or after the new position
  if (existing) {
    for (const s of existing) {
      if (s.sortOrder >= newSortOrder) {
        await db.from('Scene').update({ sortOrder: s.sortOrder + 1, updatedAt: now }).eq('id', s.id)
      }
    }
  }

  const id = crypto.randomUUID()
  const row = {
    id,
    projectId,
    sceneNumber,
    title: fields.title ?? null,
    description: fields.description ?? null,
    sortOrder: newSortOrder,
    createdAt: now,
    updatedAt: now,
  }
  console.log('[createSceneAtPosition] inserting after sortOrder', insertAfterSortOrder, row)
  const { error } = await db.from('Scene').insert(row)
  if (error) { console.error('[createSceneAtPosition] FAILED:', error); throw error }
  return { id }
}

export async function updateScene(
  sceneId: string,
  fields: { title?: string; description?: string }
): Promise<void> {
  const db = createClient()
  console.log('[ScriptView] saving scene', sceneId, fields)
  const { error } = await db
    .from('Scene')
    .update(fields)
    .eq('id', sceneId)
  if (error) { console.error('[updateScene] FAILED:', error); throw error }
}

export async function deleteScene(sceneId: string): Promise<void> {
  const db = createClient()
  // Delete all shots in this scene first
  const { error: shotErr } = await db.from('Shot').delete().eq('sceneId', sceneId)
  if (shotErr) { console.error('[deleteScene] Failed to delete shots:', shotErr); throw shotErr }
  const { error } = await db.from('Scene').delete().eq('id', sceneId)
  if (error) { console.error('[deleteScene] FAILED:', error); throw error }
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

export async function updateShootOrder(
  updates: { id: string; shootOrder: number }[]
): Promise<void> {
  const db = createClient()
  await Promise.all(
    updates.map(u =>
      db.from('Shot').update({ shootOrder: u.shootOrder }).eq('id', u.id)
        .then(({ error }) => { if (error) throw error })
    )
  )
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
// ── SHOTLIST VERSIONS ─────────────────────────────────────

export async function getShotlistVersions(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('ShotlistVersion')
    .select('*')
    .eq('projectId', projectId)
    .order('versionNumber', { ascending: false })
  if (error) { console.error('getShotlistVersions failed:', error); throw error }
  return data ?? []
}

export async function createShotlistVersion(version: {
  projectId: string
  versionNumber: number
  label?: string | null
  shots: any
}) {
  const db = createClient()
  const { data, error } = await db
    .from('ShotlistVersion')
    .insert(version)
    .select()
    .single()
  if (error) { console.error('createShotlistVersion failed:', error); throw error }
  return data
}

export async function updateShotlistVersionLabel(id: string, label: string | null) {
  const db = createClient()
  const { error } = await db
    .from('ShotlistVersion')
    .update({ label })
    .eq('id', id)
  if (error) { console.error('updateShotlistVersionLabel failed:', error); throw error }
}

export async function updateShot(
  shotId: string,
  fields: { description?: string; size?: string | null; imageUrl?: string | null; status?: string; notes?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Shot')
    .update(fields)
    .eq('id', shotId)
  if (error) { console.error('updateShot failed:', error); throw error }
}

export async function uploadStoryboardImage(file: File, projectId: string, shotId: string): Promise<string> {
  const db = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${projectId}/${shotId}.${ext}`

  const { error } = await db.storage.from('storyboard').upload(path, file, {
    contentType: file.type || 'image/png',
    upsert: true,
  })
  if (error) {
    console.error('uploadStoryboardImage failed:', error)
    throw error
  }

  const { data: { publicUrl } } = db.storage.from('storyboard').getPublicUrl(path)
  return publicUrl
}

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
// ── ENTITIES (characters, props) ─────────────────────────

export async function getEntities(projectId: string, type?: 'character' | 'prop') {
  const db = createClient()
  let q = db.from('Entity').select('*').eq('projectId', projectId).order('createdAt', { ascending: true })
  if (type) q = q.eq('type', type)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createEntity(entity: {
  projectId: string; type: 'character' | 'prop'; name: string; description?: string; metadata?: Record<string, any>
}) {
  const db = createClient()
  const { data, error } = await db
    .from('Entity')
    .insert({
      id: crypto.randomUUID(),
      projectId: entity.projectId,
      type: entity.type,
      name: entity.name,
      description: entity.description ?? null,
      metadata: entity.metadata ?? null,
    })
    .select()
    .single()
  if (error) { console.error('createEntity failed:', error); throw error }
  return data
}

export async function updateEntity(
  id: string,
  fields: { name?: string; description?: string | null; metadata?: Record<string, any> | null }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Entity').update(fields).eq('id', id)
  if (error) { console.error('updateEntity failed:', error); throw error }
}

export async function deleteEntity(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Entity').delete().eq('id', id)
  if (error) { console.error('deleteEntity failed:', error); throw error }
}

export async function getCastRoles(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Entity')
    .select('*, TalentAssignment(id, Talent(*))')
    .eq('projectId', projectId)
    .eq('type', 'character')
    .order('createdAt', { ascending: true })
  if (error) { console.error('getCastRoles failed:', error); throw error }

  const initials = (n: string) => (n ?? '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '+'

  return (data ?? []).map((e: any) => {
    const md = (e.metadata ?? {}) as { section?: string; scenes?: string[]; notes?: string }
    const assignment = (e.TalentAssignment ?? [])[0]
    const t = assignment?.Talent ?? null
    return {
      id: e.id,
      projectId: e.projectId,
      role: e.name,
      roleDesc: e.description ?? '',
      section: md.section ?? 'Principal Cast',
      scenes: Array.isArray(md.scenes) ? md.scenes : [],
      roleNotes: md.notes ?? '',
      assignmentId: assignment?.id ?? null,
      cast: !!t,
      talent: t ? {
        id: t.id,
        name: t.name ?? '',
        initials: initials(t.name ?? ''),
        agency: t.agency ?? '',
        email: t.email ?? '',
        phone: t.phone ?? '',
        repName: t.repName ?? '',
        repEmail: t.repEmail ?? '',
        repPhone: t.repPhone ?? '',
        dietary: t.dietaryRestrictions ?? '',
        shootDates: Array.isArray(t.shootDates) ? t.shootDates : [],
        notes: t.notes ?? '',
      } : null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }
  })
}

export async function updateCastRole(id: string, updates: { name?: string; description?: string | null; metadata?: Record<string, any> | null }) {
  const db = createClient()
  const { error } = await db.from('Entity').update(updates).eq('id', id)
  if (error) { console.error('updateCastRole failed:', error); throw error }
}

export async function createCastRole(input: {
  projectId: string
  role: string
  roleDesc?: string
  section?: string
  scenes?: string[]
  actorName?: string
}) {
  const db = createClient()
  const now = new Date().toISOString()
  const entityId = crypto.randomUUID()
  const { error: eErr } = await db.from('Entity').insert({
    id: entityId,
    projectId: input.projectId,
    type: 'character',
    name: input.role,
    description: input.roleDesc ?? null,
    metadata: { section: input.section ?? 'Principal Cast', scenes: input.scenes ?? [] },
    createdAt: now,
    updatedAt: now,
  })
  if (eErr) { console.error('createCastRole entity failed:', eErr); throw eErr }

  if (input.actorName && input.actorName.trim()) {
    const talentId = `cast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const { error: tErr } = await db.from('Talent').insert({
      id: talentId,
      projectId: input.projectId,
      name: input.actorName.trim(),
      createdAt: now,
      updatedAt: now,
    })
    if (tErr) { console.error('createCastRole talent failed:', tErr); throw tErr }
    const assignmentId = `ta_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const { error: aErr } = await db.from('TalentAssignment').insert({
      id: assignmentId,
      talentId,
      entityId,
      createdAt: now,
    })
    if (aErr) { console.error('createCastRole assignment failed:', aErr); throw aErr }
  }
  return { id: entityId }
}

export async function updateTalent(
  id: string,
  fields: { name?: string; agency?: string | null; email?: string | null; phone?: string | null; repName?: string | null; repEmail?: string | null; repPhone?: string | null; dietaryRestrictions?: string | null; shootDates?: string[] | null; notes?: string | null }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Talent').update({ ...fields, updatedAt: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('updateTalent failed:', error); throw error }
}

export async function assignTalentToRole(input: {
  projectId: string
  entityId: string
  actorName: string
}) {
  const db = createClient()
  const now = new Date().toISOString()
  const talentId = `cast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const { error: tErr } = await db.from('Talent').insert({
    id: talentId,
    projectId: input.projectId,
    name: input.actorName,
    createdAt: now,
    updatedAt: now,
  })
  if (tErr) { console.error('assignTalentToRole talent failed:', tErr); throw tErr }
  const assignmentId = `ta_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const { error: aErr } = await db.from('TalentAssignment').insert({
    id: assignmentId,
    talentId,
    entityId: input.entityId,
    createdAt: now,
  })
  if (aErr) { console.error('assignTalentToRole assignment failed:', aErr); throw aErr }
  return { talentId, assignmentId }
}

export async function deleteCastRole(entityId: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Entity').delete().eq('id', entityId)
  if (error) { console.error('deleteCastRole failed:', error); throw error }
}
export async function getArtItems(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Entity')
    .select('*')
    .eq('projectId', projectId)
    .in('type', ['prop', 'wardrobe', 'hmu'])
    .order('createdAt', { ascending: true })
  if (error) throw error
  return data
}

export async function createArtItem(item: {
  projectId: string; type: 'prop' | 'wardrobe' | 'hmu'; name: string; description?: string; metadata?: Record<string, any>
}) {
  const db = createClient()
  const { data, error } = await db
    .from('Entity')
    .insert({
      id: crypto.randomUUID(),
      projectId: item.projectId,
      type: item.type,
      name: item.name,
      description: item.description ?? null,
      metadata: item.metadata ?? null,
    })
    .select()
    .single()
  if (error) { console.error('createArtItem failed:', error); throw error }
  return data
}

export async function updateArtItem(
  id: string,
  fields: { name?: string; description?: string | null; metadata?: Record<string, any> | null }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Entity').update(fields).eq('id', id)
  if (error) { console.error('updateArtItem failed:', error); throw error }
}

export async function deleteArtItem(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Entity').delete().eq('id', id)
  if (error) { console.error('deleteArtItem failed:', error); throw error }
}
// ── WORKFLOW NODES ───────────────────────────────────────

export async function getWorkflowNodes(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('WorkflowNode')
    .select('*')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return data
}

export async function createWorkflowNode(node: {
  projectId: string; label: string; type: string; software?: string; notes?: string; assigneeId?: string | null; sortOrder?: number
}) {
  const db = createClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('WorkflowNode')
    .insert({
      id: crypto.randomUUID(),
      projectId: node.projectId,
      label: node.label,
      type: node.type,
      software: node.software ?? null,
      notes: node.notes ?? null,
      assigneeId: node.assigneeId ?? null,
      sortOrder: node.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single()
  if (error) { console.error('createWorkflowNode failed:', error); throw error }
  return data
}

export async function updateWorkflowNode(
  id: string,
  fields: { label?: string; type?: string; software?: string | null; notes?: string | null; assigneeId?: string | null; sortOrder?: number }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('WorkflowNode').update({ ...fields, updatedAt: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('updateWorkflowNode failed:', error); throw error }
}

export async function deleteWorkflowNode(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('WorkflowNode').delete().eq('id', id)
  if (error) { console.error('deleteWorkflowNode failed:', error); throw error }
}

// ── WORKFLOW EDGES ───────────────────────────────────────

export async function getWorkflowEdges(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('WorkflowEdge')
    .select('*')
    .eq('projectId', projectId)
    .order('createdAt', { ascending: true })
  if (error) throw error
  return data
}

export async function createWorkflowEdge(edge: {
  projectId: string; sourceId: string; targetId: string; format?: string; inputFormat?: string; outputFormat?: string; handoff?: string; notes?: string
}) {
  const db = createClient()
  const { data, error } = await db
    .from('WorkflowEdge')
    .insert({
      id: crypto.randomUUID(),
      projectId: edge.projectId,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      format: edge.format ?? null,
      inputFormat: edge.inputFormat ?? null,
      outputFormat: edge.outputFormat ?? null,
      handoff: edge.handoff ?? null,
      notes: edge.notes ?? null,
    })
    .select()
    .single()
  if (error) { console.error('createWorkflowEdge failed:', error); throw error }
  return data
}

export async function updateWorkflowEdge(
  id: string,
  fields: { format?: string | null; inputFormat?: string | null; outputFormat?: string | null; handoff?: string | null; notes?: string | null }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('WorkflowEdge').update(fields).eq('id', id)
  if (error) { console.error('updateWorkflowEdge failed:', error); throw error }
}

export async function deleteWorkflowEdge(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('WorkflowEdge').delete().eq('id', id)
  if (error) { console.error('deleteWorkflowEdge failed:', error); throw error }
}

// ── DELIVERABLES ─────────────────────────────────────────

export async function getDeliverables(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Deliverable')
    .select('*')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return data
}

export async function createDeliverable(del: {
  projectId: string; title: string; length?: string; format?: string; aspectRatio?: string; resolution?: string; colorSpace?: string; soundSpecs?: string; notes?: string; sortOrder?: number
}) {
  const db = createClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('Deliverable')
    .insert({
      id: crypto.randomUUID(),
      projectId: del.projectId,
      title: del.title,
      length: del.length ?? null,
      format: del.format ?? null,
      aspectRatio: del.aspectRatio ?? null,
      resolution: del.resolution ?? null,
      colorSpace: del.colorSpace ?? null,
      soundSpecs: del.soundSpecs ?? null,
      notes: del.notes ?? null,
      sortOrder: del.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single()
  if (error) { console.error('createDeliverable failed:', error); throw error }
  return data
}

export async function updateDeliverable(
  id: string,
  fields: { title?: string; length?: string | null; format?: string | null; aspectRatio?: string | null; resolution?: string | null; colorSpace?: string | null; soundSpecs?: string | null; notes?: string | null; sortOrder?: number }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Deliverable').update({ ...fields, updatedAt: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('updateDeliverable failed:', error); throw error }
}

export async function deleteDeliverable(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Deliverable').delete().eq('id', id)
  if (error) { console.error('deleteDeliverable failed:', error); throw error }
}

// ── CHAT CHANNELS ─────────────────────────────────────────

export async function getChatChannels(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('ChatChannel')
    .select('*')
    .eq('projectId', projectId)
    .order('sortOrder', { ascending: true })
    .order('createdAt', { ascending: true })
  if (error) { console.error('getChatChannels failed:', error); throw error }
  let channels = data ?? []
  // Lazy-seed Team channel if none exist
  if (channels.length === 0) {
    const { data: seeded, error: sErr } = await db
      .from('ChatChannel')
      .insert({ id: crypto.randomUUID(), projectId, name: 'Team', sortOrder: 0 })
      .select()
      .single()
    if (sErr) { console.error('getChatChannels seed failed:', sErr); throw sErr }
    channels = [seeded]
  }
  return channels
}

export async function createChatChannel(input: { projectId: string; name: string; sortOrder?: number }) {
  const db = createClient()
  const { data, error } = await db
    .from('ChatChannel')
    .insert({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
    })
    .select()
    .single()
  if (error) { console.error('createChatChannel failed:', error); throw error }
  return data
}

// ── CHAT MESSAGES ─────────────────────────────────────────

export async function getChannelMessages(channelId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('ChatMessage')
    .select('*, sender:User!ChatMessage_senderId_fkey(id,name,avatarUrl)')
    .eq('channelId', channelId)
    .order('createdAt', { ascending: true })
  if (error) { console.error('getChannelMessages failed:', error); throw error }
  return data ?? []
}

export async function getDMMessages(projectId: string, userA: string, userB: string) {
  const db = createClient()
  const { data, error } = await db
    .from('ChatMessage')
    .select('*, sender:User!ChatMessage_senderId_fkey(id,name,avatarUrl)')
    .is('channelId', null)
    .eq('projectId', projectId)
    .or(`and(senderId.eq.${userA},recipientId.eq.${userB}),and(senderId.eq.${userB},recipientId.eq.${userA})`)
    .order('createdAt', { ascending: true })
  if (error) { console.error('getDMMessages failed:', error); throw error }
  return data ?? []
}

/** Returns one entry per DM partner with the most recent message */
export async function getDMList(projectId: string, meId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('ChatMessage')
    .select('*')
    .is('channelId', null)
    .eq('projectId', projectId)
    .or(`senderId.eq.${meId},recipientId.eq.${meId}`)
    .order('createdAt', { ascending: false })
  if (error) { console.error('getDMList failed:', error); throw error }
  // Collapse by partner
  const byPartner = new Map<string, any>()
  for (const m of data ?? []) {
    const partnerId = m.senderId === meId ? m.recipientId : m.senderId
    if (!partnerId) continue
    if (!byPartner.has(partnerId)) byPartner.set(partnerId, { partnerId, lastMessage: m.content, lastAt: m.createdAt, unread: false })
  }
  return Array.from(byPartner.values())
}

export async function sendChatMessage(input: {
  projectId: string
  channelId?: string | null
  senderId: string
  recipientId?: string | null
  content: string
}) {
  const db = createClient()
  const { data, error } = await db
    .from('ChatMessage')
    .insert({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      channelId: input.channelId ?? null,
      senderId: input.senderId,
      recipientId: input.recipientId ?? null,
      content: input.content,
    })
    .select()
    .single()
  if (error) { console.error('sendChatMessage failed:', error); throw error }
  return data
}

/** Subscribe to new messages. Returns unsubscribe fn. */
export function subscribeToChatMessages(
  filter: { channelId?: string | null; projectId?: string },
  onInsert: (msg: any) => void,
) {
  const db = createClient()
  let channelName = 'chat-msgs'
  if (filter.channelId) channelName += `-c-${filter.channelId}`
  if (filter.projectId) channelName += `-p-${filter.projectId}`
  // Unique per subscription instance so repeat mounts don't collide on the same Supabase channel
  channelName += `-${crypto.randomUUID()}`

  const ch = db.channel(channelName)

  // Register listeners BEFORE subscribing
  ch.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'ChatMessage' },
    (payload: any) => {
      const m = payload.new
      if (filter.channelId !== undefined && m.channelId !== filter.channelId) return
      if (filter.projectId && m.projectId !== filter.projectId) return
      onInsert(m)
    },
  )

  ch.subscribe()

  return () => { db.removeChannel(ch) }
}
