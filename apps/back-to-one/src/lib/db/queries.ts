import { createClient } from './client'
import type {
  Project, Folder, CrewMember, ActionItem, Milestone,
  SceneMakerVersion, Scene, Shot, MoodboardRef,
  LocationGroup, CastRole, ArtItem,
  Thread, ThreadMessage, Resource, WorkflowNode,
} from '@/types'

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── PROJECTS ───────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const db = createClient()
  // Try filtering out archived; fall back if column doesn't exist yet
  const { data, error } = await db
    .from('projects')
    .select('*')
    .neq('archived', true)
    .order('created_at', { ascending: false })
  if (error) {
    // Column may not exist — retry without filter
    const { data: fallback, error: err2 } = await db
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (err2) throw err2
    return fallback
  }
  return data
}

export async function archiveProject(projectId: string): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('projects')
    .update({ archived: true })
    .eq('id', projectId)
  if (error) { console.error('archiveProject failed:', error); throw error }
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('projects')
    .delete()
    .eq('id', projectId)
  if (error) { console.error('deleteProject failed:', error); throw error }
}

export async function getProject(id: string): Promise<Project> {
  const db = createClient()
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProject(
  project: Omit<Project, 'sceneCount' | 'shotCount' | 'createdAt' | 'updatedAt'>
): Promise<Project> {
  const db = createClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('projects')
    .insert({
      id: project.id, name: project.name, type: project.type, client: project.client,
      company: project.company, phase: project.phase, status: project.status, logline: project.logline,
      runtime_target: project.runtimeTarget, aspect_ratio: project.aspectRatio,
      capture_format: project.captureFormat, start_date: project.startDate,
      shoot_date: project.shootDate, shoot_date_end: project.shootDateEnd,
      delivery_date: project.deliveryDate, scene_count: 0, shot_count: 0,
      created_at: now, updated_at: now,
    })
    .select()
    .single()
  if (error) { console.error('createProject failed:', error); throw error }
  return data
}

export async function updateProject(
  projectId: string,
  fields: { name?: string; client?: string; accent_color?: string; folder_id?: string | null; display_order?: number }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('projects')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) { console.error('updateProject failed:', error); throw error }
}

// ── FOLDERS ───────────────────────────────────────────────

export async function getFolders(): Promise<Folder[]> {
  const db = createClient()
  const { data, error } = await db
    .from('folders')
    .select('*')
    .order('order', { ascending: true })
  if (error) {
    // Table may not exist yet — return empty
    console.warn('getFolders: table may not exist yet', error.message)
    return []
  }
  return data
}

export async function createFolder(
  folder: { id: string; name: string; color: string; logo_url?: string | null; order: number }
): Promise<Folder> {
  const db = createClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('folders')
    .insert({ ...folder, created_at: now, updated_at: now })
    .select()
    .single()
  if (error) { console.error('createFolder failed:', error); throw error }
  return data
}

export async function updateFolder(
  folderId: string,
  fields: { name?: string; color?: string; logo_url?: string | null; order?: number }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('folders')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', folderId)
  if (error) { console.error('updateFolder failed:', error); throw error }
}

export async function deleteFolder(folderId: string): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('folders')
    .delete()
    .eq('id', folderId)
  if (error) { console.error('deleteFolder failed:', error); throw error }
}

export async function updateProjectOrder(
  projectId: string,
  fields: { display_order?: number; folder_id?: string | null }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('projects')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) { console.error('updateProjectOrder failed:', error); throw error }
}

// ── CREW ───────────────────────────────────────────────────

export async function getAllCrew(): Promise<(CrewMember & { projectName?: string })[]> {
  const db = createClient()
  const { data, error } = await db
    .from('crew_members')
    .select('*, projects(name)')
    .order('first', { ascending: true })
  if (error) throw error
  return data.map((c: any) => ({ ...c, projectName: c.projects?.name }))
}


export async function getCrew(projectId: string): Promise<CrewMember[]> {
  const db = createClient()
  const { data, error } = await db
    .from('crew_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function addCrewMember(
  member: Omit<CrewMember, 'id' | 'online'>
): Promise<CrewMember> {
  const db = createClient()
  const id = genId()
  const { data, error } = await db
    .from('crew_members')
    .insert({
      id, project_id: member.projectId,
      first: member.first, last: member.last, role: member.role, dept: member.dept,
      color1: member.color1, color2: member.color2, online: false,
      phone: member.phone || '', email: member.email || '',
      allergies: member.allergies || '', deal_memo_url: member.dealMemoUrl || '',
      notes: member.notes || '', avatar_url: member.avatarUrl || '',
      display_order: member.displayOrder ?? 0,
    })
    .select()
    .single()
  if (error) { console.error('addCrewMember failed:', error); throw error }
  return data
}

export async function removeCrewMember(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('crew_members').delete().eq('id', id)
  if (error) { console.error('removeCrewMember failed:', error); throw error }
}

export async function updateCrewMember(
  id: string,
  fields: Partial<Pick<CrewMember, 'first' | 'last' | 'role' | 'dept' | 'phone' | 'email' | 'allergies' | 'notes'>> & { deal_memo_url?: string; avatar_url?: string; display_order?: number }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('crew_members').update(fields).eq('id', id)
  if (error) { console.error('updateCrewMember failed:', error); throw error }
}

// ── ACTION ITEMS ───────────────────────────────────────────

export async function getActionItems(projectId: string): Promise<ActionItem[]> {
  const db = createClient()
  const { data, error } = await db
    .from('action_items')
    .select('*')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

export async function toggleActionItem(id: string, done: boolean): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('action_items')
    .update({ done, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('toggleActionItem failed:', error); throw error }
}

export async function createActionItem(
  item: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ActionItem> {
  const db = createClient()
  const id = genId()
  const { data, error } = await db
    .from('action_items')
    .insert({ id, project_id: item.projectId, name: item.name, dept: item.dept, assignee_id: item.assigneeId, due_date: item.dueDate, notes: item.notes, done: item.done })
    .select()
    .single()
  if (error) { console.error('createActionItem failed:', error); throw error }
  return data
}

// ── MILESTONES ─────────────────────────────────────────────

export async function getMilestones(projectId: string): Promise<Milestone[]> {
  const db = createClient()
  const { data, error } = await db
    .from('milestones')
    .select(`*, milestone_people(crew_id)`)
    .eq('project_id', projectId)
    .order('date', { ascending: true })
  if (error) throw error
  return data.map(m => ({
    ...m,
    people: m.milestone_people.map((p: { crew_id: string }) => p.crew_id),
  }))
}

export async function createMilestone(
  milestone: Omit<Milestone, 'id' | 'createdAt' | 'isNext'> & { people: string[] }
): Promise<Milestone> {
  const db = createClient()
  const { people, projectId, ...fields } = milestone
  const id = genId()
  const { data, error } = await db
    .from('milestones')
    .insert({ id, project_id: projectId, name: fields.name, phase: fields.phase, dept: fields.dept, date: fields.date, notes: fields.notes })
    .select()
    .single()
  if (error) { console.error('createMilestone failed:', error); throw error }
  if (people.length > 0) {
    const { error: pErr } = await db
      .from('milestone_people')
      .insert(people.map(crew_id => ({ milestone_id: id, crew_id })))
    if (pErr) { console.error('createMilestone people failed:', pErr); throw pErr }
  }
  return { ...data, people }
}

// ── SCENEMAKER ─────────────────────────────────────────────

export async function getSceneMakerVersions(projectId: string): Promise<SceneMakerVersion[]> {
  const db = createClient()
  const { data, error } = await db
    .from('sm_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((v: any) => ({
    ...v,
    projectId: v.project_id ?? v.projectId,
    isCurrent: v.is_current ?? v.isCurrent,
    createdAt: v.created_at ?? v.createdAt,
  }))
}

export async function getSMScenes(versionId: string): Promise<Scene[]> {
  const db = createClient()
  const { data, error } = await db
    .from('sm_scenes')
    .select('*')
    .eq('version_id', versionId)
    .order('num', { ascending: true })
  if (error) throw error
  return (data ?? []).map((s: any) => ({
    ...s,
    projectId: s.project_id ?? s.projectId,
    versionId: s.version_id ?? s.versionId,
    createdAt: s.created_at ?? s.createdAt,
  }))
}

export async function getSMShots(versionId: string): Promise<Shot[]> {
  const db = createClient()
  const { data, error } = await db
    .from('sm_shots')
    .select('*')
    .eq('version_id', versionId)
    .order('story_order', { ascending: true })
  if (error) throw error
  // Map snake_case DB columns to camelCase type fields
  return (data ?? []).map((s: any) => ({
    ...s,
    desc: s.description ?? s.desc ?? '',
    sceneId: s.scene_id ?? s.sceneId,
    versionId: s.version_id ?? s.versionId,
    projectId: s.project_id ?? s.projectId,
    storyOrder: s.story_order ?? s.storyOrder,
    shootOrder: s.shoot_order ?? s.shootOrder,
    dirNotes: s.dir_notes ?? s.dirNotes ?? '',
    prodNotes: s.prod_notes ?? s.prodNotes ?? '',
    createdAt: s.created_at ?? s.createdAt,
    updatedAt: s.updated_at ?? s.updatedAt,
  }))
}

export async function updateShotOrder(
  shotId: string,
  fields: { story_order?: number; shoot_order?: number; scene_id?: string }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('sm_shots')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', shotId)
  if (error) throw error
}

export async function updateShotImages(
  shotId: string,
  images: string[]
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('sm_shots')
    .update({ images, updated_at: new Date().toISOString() })
    .eq('id', shotId)
  if (error) throw error
}

export async function createShot(shot: {
  id: string
  projectId: string
  versionId: string
  sceneId: string
  storyOrder: number
  shootOrder: number
  desc: string
  framing: string
  movement: string
  lens: string
  dirNotes: string
}): Promise<Shot> {
  const db = createClient()
  const { data, error } = await db
    .from('sm_shots')
    .insert({
      id: shot.id,
      project_id: shot.projectId,
      version_id: shot.versionId,
      scene_id: shot.sceneId,
      story_order: shot.storyOrder,
      shoot_order: shot.shootOrder,
      description: shot.desc,
      framing: shot.framing,
      movement: shot.movement,
      lens: shot.lens,
      dir_notes: shot.dirNotes,
      prod_notes: '',
      elements: [],
      images: [],
      status: 'planned',
    })
    .select()
    .single()
  if (error) throw error
  return {
    ...data,
    desc: data.description ?? '',
    sceneId: data.scene_id,
    versionId: data.version_id,
    projectId: data.project_id,
    storyOrder: data.story_order,
    shootOrder: data.shoot_order,
    dirNotes: data.dir_notes ?? '',
    prodNotes: data.prod_notes ?? '',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

// ── MOODBOARD ──────────────────────────────────────────────

export async function getMoodboardRefs(projectId: string): Promise<MoodboardRef[]> {
  const db = createClient()
  const { data, error } = await db
    .from('moodboard_refs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createMoodboardRef(
  ref: Omit<MoodboardRef, 'id' | 'createdAt'>
): Promise<MoodboardRef> {
  const db = createClient()
  const id = genId()
  const { data, error } = await db
    .from('moodboard_refs')
    .insert({ id, project_id: ref.projectId, cat: ref.cat, title: ref.title, note: ref.note, image_url: ref.imageUrl, gradient: ref.gradient })
    .select()
    .single()
  if (error) { console.error('createMoodboardRef failed:', error); throw error }
  return data
}

// ── LOCATIONS ──────────────────────────────────────────────

export async function getLocationGroups(projectId: string): Promise<LocationGroup[]> {
  const db = createClient()
  const { data, error } = await db
    .from('location_groups')
    .select(`*, location_options(*)`)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function updateLocationStatus(
  optionId: string,
  status: string
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('location_options')
    .update({ status })
    .eq('id', optionId)
  if (error) throw error
}

// ── CASTING ────────────────────────────────────────────────

export async function getCastRoles(projectId: string): Promise<CastRole[]> {
  const db = createClient()
  const { data, error } = await db
    .from('cast_roles')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function updateCastRole(
  id: string,
  updates: Partial<CastRole>
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('cast_roles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── ART ────────────────────────────────────────────────────

export async function getArtItems(projectId: string): Promise<ArtItem[]> {
  const db = createClient()
  const { data, error } = await db
    .from('art_items')
    .select('*')
    .eq('project_id', projectId)
    .order('cat', { ascending: true })
  if (error) throw error
  return data
}

// ── THREADS ────────────────────────────────────────────────

export async function getThreads(projectId: string): Promise<Thread[]> {
  const db = createClient()
  const { data, error } = await db
    .from('threads')
    .select(`*, thread_messages(*)`)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(t => ({
    ...t,
    unread: false, // computed client-side against last-read timestamp
    messages: t.thread_messages,
  }))
}

export async function createThread(
  projectId: string,
  subject: string,
  contextType: string = 'general',
  contextLabel: string = '',
  contextRef: string = '',
): Promise<Thread> {
  const db = createClient()
  const id = genId()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('threads')
    .insert({ id, project_id: projectId, subject, context_type: contextType, context_label: contextLabel, context_ref: contextRef, created_at: now, updated_at: now })
    .select()
    .single()
  if (error) { console.error('createThread failed:', error); throw error }
  return { ...data, unread: false, messages: [] }
}

export async function postMessage(
  threadId: string,
  authorId: string,
  tagged: string[],
  text: string
): Promise<ThreadMessage> {
  const db = createClient()
  const id = genId()
  const { data, error } = await db
    .from('thread_messages')
    .insert({ id, thread_id: threadId, author_id: authorId || null, tagged, text })
    .select()
    .single()
  if (error) { console.error('postMessage failed:', error); throw error }
  // Bump thread updated_at
  const { error: updateErr } = await db.from('threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
  if (updateErr) console.error('postMessage thread bump failed:', updateErr)
  return data
}

// ── RESOURCES ──────────────────────────────────────────────

export async function getResources(projectId: string): Promise<Resource[]> {
  const db = createClient()
  const { data, error } = await db
    .from('resources')
    .select('*')
    .eq('project_id', projectId)
    .order('pinned', { ascending: false })
  if (error) throw error
  return data
}

export async function createResource(
  resource: Omit<Resource, 'id' | 'createdAt'>
): Promise<Resource> {
  const db = createClient()
  const id = genId()
  const { data, error } = await db
    .from('resources')
    .insert({ id, project_id: resource.projectId, cat: resource.cat, type: resource.type, title: resource.title, meta: resource.meta, url: resource.url, pinned: resource.pinned })
    .select()
    .single()
  if (error) { console.error('createResource failed:', error); throw error }
  return data
}

// ── WORKFLOW ───────────────────────────────────────────────

export async function getWorkflowNodes(projectId: string): Promise<WorkflowNode[]> {
  const db = createClient()
  const { data, error } = await db
    .from('workflow_nodes')
    .select('*')
    .eq('project_id', projectId)
    .order('order', { ascending: true })
  if (error) throw error
  return data
}

// ── GLOBAL QUERIES (cross-project) ────────────────────────

export async function getAllActionItems(): Promise<ActionItem[]> {
  const db = createClient()
  const { data, error } = await db
    .from('action_items')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

export async function getAllMilestones(): Promise<Milestone[]> {
  const db = createClient()
  const { data, error } = await db
    .from('milestones')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return data
}

export async function getAllThreads(): Promise<Thread[]> {
  const db = createClient()
  const { data, error } = await db
    .from('threads')
    .select(`*, thread_messages(*)`)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(t => ({
    ...t,
    unread: false,
    messages: t.thread_messages,
  }))
}
