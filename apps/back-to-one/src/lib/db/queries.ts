import { createBrowserAuthClient as createClient } from '@origin-one/auth'
import { DEFAULT_AICP_ACCOUNTS } from '@origin-one/schema'
import { initials } from '@/lib/utils/formatting'
import { syncExpenseFromTimecard, deleteExpenseForTimecard } from '@/lib/budget/timecard-to-expense'

// ── STORAGE ───────────────────────────────────────────────

// PR 14 — Manual expense receipt upload + signed-URL helpers.
//
// The receipts bucket is PRIVATE (public=false) per PR 4 — auth-check
// RLS on read/insert/update/delete from day one (storage discipline
// rule for new buckets). That means:
//   - Upload returns the storage path, NOT a public URL.
//   - Display layer fetches a short-lived signed URL on demand.
//   - `Expense.receiptUrl` stores the path (named for legacy clarity).
//
// 5 MB + MIME allowlist enforced server-side by the bucket config (PR 4
// migration); client-side checks below short-circuit a network round-
// trip on rejection.

const RECEIPTS_BUCKET = 'receipts'
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024
const RECEIPT_ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf',
])

export class ReceiptValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ReceiptValidationError' }
}

export function validateReceiptFile(file: File): void {
  if (!RECEIPT_ALLOWED_MIME.has(file.type)) {
    throw new ReceiptValidationError(
      `File type not supported (${file.type || 'unknown'}). Use PNG, JPEG, WebP, HEIC, or PDF.`,
    )
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    throw new ReceiptValidationError(
      `Receipt too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 5 MB.`,
    )
  }
}

export async function uploadExpenseReceipt(
  file: File,
  projectId: string,
  lineId: string,
): Promise<{ path: string }> {
  validateReceiptFile(file)
  const db = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? guessExtFromMime(file.type)
  const path = `${projectId}/${lineId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await db.storage.from(RECEIPTS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  })
  if (error) {
    console.error('uploadExpenseReceipt failed:', error)
    if (error.message?.includes('Bucket not found')) {
      throw new Error('Receipts bucket not configured. Run `pnpm --filter @origin-one/db exec prisma migrate deploy`.')
    }
    if (error.message?.includes('mime type')) {
      throw new Error('File type not supported. Use PNG, JPEG, WebP, HEIC, or PDF.')
    }
    if (error.message?.toLowerCase().includes('size') || error.message?.includes('exceeded')) {
      throw new Error('File too large. Maximum 5 MB.')
    }
    throw new Error(error.message || 'Upload failed. Please try again.')
  }
  return { path }
}

function guessExtFromMime(mime: string): string {
  if (mime === 'image/png')        return 'png'
  if (mime === 'image/jpeg')       return 'jpg'
  if (mime === 'image/webp')       return 'webp'
  if (mime === 'image/heic')       return 'heic'
  if (mime === 'application/pdf')  return 'pdf'
  return 'bin'
}

// Resolve a storage path stored on Expense.receiptUrl into a short-
// lived signed URL the browser can fetch. 1-hour expiry — well past
// the typical render lifecycle and within Supabase's max.
export async function getReceiptSignedUrl(path: string): Promise<string | null> {
  const db = createClient()
  const { data, error } = await db.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error || !data) {
    console.error('getReceiptSignedUrl failed:', error)
    return null
  }
  return data.signedUrl
}

export async function deleteExpenseReceipt(path: string): Promise<void> {
  const db = createClient()
  const { error } = await db.storage.from(RECEIPTS_BUCKET).remove([path])
  if (error) {
    console.error('deleteExpenseReceipt failed:', error)
    throw error
  }
}

export async function uploadMoodboardImage(file: File, projectId: string): Promise<string> {
  const db = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await db.storage.from('moodboard').upload(path, file, { upsert: true })
  if (error) {
    console.error('uploadMoodboardImage failed:', error)
    if (error.message?.includes('Bucket not found')) {
      throw new Error('Storage bucket not configured. Run `pnpm --filter @origin-one/db exec prisma migrate deploy`.')
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

// ── ENTITY ATTACHMENTS — polymorphic image gallery ──────────────────────────
// Reference spec: apps/back-to-one/reference/back-to-one-entity-attachments.html
// DECISIONS: "EntityAttachment storage — v1 unsigned public URLs, RLS deferred."

export type EntityAttachmentType =
  | 'location'
  | 'narrativeLocation'
  | 'prop'
  | 'narrativeProp'
  | 'wardrobe'
  | 'narrativeWardrobe'
  | 'hmu'
  | 'cast'
  | 'moodboardRef'

export interface EntityAttachmentRow {
  id: string
  projectId: string
  attachedToType: EntityAttachmentType
  attachedToId: string
  storagePath: string
  publicUrl: string
  caption: string | null
  uploadedById: string | null
  uploadedAt: string
  width: number | null
  height: number | null
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
  updatedAt: string
}

const ENTITY_ATTACHMENTS_BUCKET = 'entity-attachments'

function probeImageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) return resolve({ width: null, height: null })
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || null
      const h = img.naturalHeight || null
      URL.revokeObjectURL(url)
      resolve({ width: w, height: h })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: null, height: null })
    }
    img.src = url
  })
}

function attachmentPublicUrl(storagePath: string, db = createClient()): string {
  // Seed-friendly escape hatch: rows whose storagePath is itself a URL
  // (Unsplash placeholders, demo CDN, etc.) render that URL directly. The
  // upload helper never produces such a value — storage paths are always
  // {type}/{id}/{rand}.{ext}.
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath
  }
  return db.storage.from(ENTITY_ATTACHMENTS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

export async function uploadEntityAttachment(args: {
  file: File
  projectId: string
  attachedToType: EntityAttachmentType
  attachedToId: string
  uploadedById?: string | null
}): Promise<EntityAttachmentRow> {
  const { file, projectId, attachedToType, attachedToId, uploadedById = null } = args
  const db = createClient()

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const rand = crypto.randomUUID()
  // Path includes projectId as the first segment so storage RLS can extract
  // it via (storage.foldername(name))[1] — see auth-005 migration.
  const storagePath = `${projectId}/${attachedToType}/${attachedToId}/${rand}.${ext}`

  const { width, height } = await probeImageDimensions(file)

  const { error: uploadErr } = await db.storage.from(ENTITY_ATTACHMENTS_BUCKET).upload(storagePath, file, {
    contentType: file.type || `image/${ext}`,
    upsert: false,
  })
  if (uploadErr) {
    console.error('uploadEntityAttachment storage failed:', uploadErr)
    if (uploadErr.message?.includes('Bucket not found')) {
      throw new Error('Storage bucket not configured. Run `pnpm --filter @origin-one/db exec prisma migrate deploy`.')
    }
    if (uploadErr.message?.includes('mime type')) {
      throw new Error('File type not supported. Use PNG, JPEG, or WebP.')
    }
    if (uploadErr.message?.includes('size')) {
      throw new Error('File too large. Maximum 10 MB.')
    }
    throw new Error(uploadErr.message || 'Upload failed. Please try again.')
  }

  const row = {
    id: crypto.randomUUID(),
    projectId,
    attachedToType,
    attachedToId,
    storagePath,
    caption: null,
    uploadedById,
    uploadedAt: new Date().toISOString(),
    width,
    height,
    mimeType: file.type || null,
    sizeBytes: file.size,
    updatedAt: new Date().toISOString(),
  }
  const { data, error } = await db.from('EntityAttachment').insert(row).select().single()
  if (error) {
    // Best-effort cleanup so we don't leave an orphan storage object on row-insert failure.
    await db.storage.from(ENTITY_ATTACHMENTS_BUCKET).remove([storagePath]).catch(() => {})
    console.error('uploadEntityAttachment insert failed:', error)
    throw new Error(error.message || 'Failed to record attachment.')
  }
  return { ...(data as any), publicUrl: attachmentPublicUrl(storagePath, db) }
}

export async function listEntityAttachments(
  projectId: string,
  attachedToType: EntityAttachmentType,
  attachedToId: string,
): Promise<EntityAttachmentRow[]> {
  const db = createClient()
  const { data, error } = await db
    .from('EntityAttachment')
    .select('*')
    .eq('projectId', projectId)
    .eq('attachedToType', attachedToType)
    .eq('attachedToId', attachedToId)
    .order('createdAt', { ascending: false })
  if (error) {
    console.error('listEntityAttachments failed:', error)
    return []
  }
  return (data ?? []).map((r: any) => ({ ...r, publicUrl: attachmentPublicUrl(r.storagePath, db) }))
}

export async function deleteEntityAttachment(id: string): Promise<void> {
  const db = createClient()
  const { data: row, error: readErr } = await db
    .from('EntityAttachment')
    .select('storagePath')
    .eq('id', id)
    .single()
  if (readErr) {
    console.error('deleteEntityAttachment read failed:', readErr)
    throw new Error(readErr.message)
  }
  // Storage delete first; if it fails, leave the row so caller can retry.
  // Orphan storage objects are worse than orphan rows.
  if (row?.storagePath) {
    const { error: storErr } = await db.storage.from(ENTITY_ATTACHMENTS_BUCKET).remove([row.storagePath])
    if (storErr) {
      console.error('deleteEntityAttachment storage failed:', storErr)
      throw new Error(storErr.message)
    }
  }
  const { error: rowErr } = await db.from('EntityAttachment').delete().eq('id', id)
  if (rowErr) {
    console.error('deleteEntityAttachment row failed:', rowErr)
    throw new Error(rowErr.message)
  }
}

export async function updateEntityAttachmentCaption(id: string, caption: string | null): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('EntityAttachment')
    .update({ caption: caption?.trim() || null, updatedAt: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.error('updateEntityAttachmentCaption failed:', error)
    throw new Error(error.message)
  }
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

export async function getArchivedProjects() {
  const db = createClient()
  const { data, error } = await db
    .from('Project')
    .select('*')
    .eq('status', 'archived')
    .order('updatedAt', { ascending: false })
  if (error) { console.error('getArchivedProjects failed:', error); throw error }
  return data ?? []
}

/**
 * Restore an archived project. We don't track the pre-archive status, so
 * default to 'post_production' as the heuristic — most archived projects
 * came from there. The user can adjust status from inside the project.
 */
export async function restoreProject(projectId: string): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('Project')
    .update({ status: 'post_production' })
    .eq('id', projectId)
  if (error) { console.error('restoreProject failed:', error); throw error }
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
  const now = new Date().toISOString()
  // Shot.updatedAt is NOT NULL with no SQL default — Prisma's @updatedAt
  // decorator only fires when Prisma is the writer, so the Supabase REST
  // client must set this explicitly. Matches the pattern in createScene
  // and createMoodboardRef. Without this, the insert silently 500s.
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
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── THREADS ────────────────────────────────────────────────

// Compute unreadCount for a thread given the viewer's ThreadRead row.
// Own messages don't count as unread — you don't need to notify yourself.
function deriveUnreadCount(messages: any[], reads: any[], meId: string | null): number {
  if (!meId) return 0
  const myRead = reads.find((r: any) => r.userId === meId)
  const lastReadAt: string | null = myRead?.lastReadAt ?? null
  let count = 0
  for (const m of messages) {
    if (m.createdBy === meId) continue
    if (lastReadAt && m.createdAt <= lastReadAt) continue
    count++
  }
  return count
}

export async function getThreads(projectId: string, meId: string | null = null) {
  const db = createClient()
  const { data, error } = await db
    .from('Thread')
    .select('*, ThreadMessage(*), ThreadRead(*)')
    .eq('projectId', projectId)
    .order('updatedAt', { ascending: false })
  if (error) throw error
  return data.map((t: any) => {
    const messages = t.ThreadMessage ?? []
    const reads = t.ThreadRead ?? []
    const unreadCount = deriveUnreadCount(messages, reads, meId)
    return {
      ...t,
      messages,
      unreadCount,
      unread: unreadCount > 0,
    }
  })
}

// Lightweight thread fetch for surfaces that only need badge/count state
// (Hub, useThreadsByEntity, scenemaker shotlist column). Drops the message
// `content` body — by far the biggest column on ThreadMessage — but keeps
// every other field so deriveUnreadCount and `messages.length` still work.
// Use getThreads (full payload) only when you actually render message bodies
// (the /threads page detail view).
export async function getThreadPreviews(projectId: string, meId: string | null = null) {
  const db = createClient()
  const { data, error } = await db
    .from('Thread')
    .select('*, ThreadMessage(id, threadId, createdBy, createdAt), ThreadRead(*)')
    .eq('projectId', projectId)
    .order('updatedAt', { ascending: false })
  if (error) throw error
  return data.map((t: any) => {
    const messages = t.ThreadMessage ?? []
    const reads = t.ThreadRead ?? []
    const unreadCount = deriveUnreadCount(messages, reads, meId)
    return {
      ...t,
      messages,
      unreadCount,
      unread: unreadCount > 0,
    }
  })
}

export async function createThread(
  projectId: string,
  attachedToType: string,
  attachedToId: string,
  createdBy: string,
) {
  const db = createClient()
  const { data, error } = await db
    .from('Thread')
    .insert({ id: crypto.randomUUID(), projectId, attachedToType, attachedToId, createdBy })
    .select()
    .single()
  if (error) throw error
  return { ...data, messages: [], unreadCount: 0, unread: false }
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
  if (error) throw error
  return data
}

// Upsert ThreadRead for (threadId, userId). Idempotent — safe to call on every
// zone-2 open. Sets lastReadAt = now(), which zeroes the thread's unreadCount
// on the next fetch.
export async function markThreadRead(threadId: string, userId: string) {
  const db = createClient()
  const { error } = await db
    .from('ThreadRead')
    .upsert(
      { threadId, userId, lastReadAt: new Date().toISOString() },
      { onConflict: 'threadId,userId' },
    )
  if (error) throw error
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
  // teamId is derived from the project (Resource.teamId NOT NULL since auth-000).
  const { data: project, error: projErr } = await db
    .from('Project').select('teamId').eq('id', resource.projectId).single()
  if (projErr || !project) {
    console.error('createResource: could not resolve teamId from projectId', projErr)
    throw projErr ?? new Error('Project not found')
  }
  const { data, error } = await db
    .from('Resource')
    .insert({
      id: crypto.randomUUID(),
      teamId: project.teamId,
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

// Cross-project (company-scoped) Resource rows — projectId IS NULL. Made
// possible by PR #32 dropping NOT NULL from Resource.projectId. Producers
// see these via the projects-root bar's resources sheet; the role gate
// becomes real on Auth day.

export async function getAllResources() {
  const db = createClient()
  const { data, error } = await db
    .from('Resource')
    .select('*')
    .is('projectId', null)
    .order('createdAt', { ascending: false })
  if (error) { console.error('getAllResources failed:', error); throw error }
  return data ?? []
}

export async function createGlobalResource(
  resource: { title: string; url: string; type: string; createdBy: string }
) {
  const db = createClient()
  // Pre-Auth: only one team exists (Origin Point). Look it up by name.
  // Post-Auth: caller passes teamId from session; remove this lookup.
  const { data: team, error: teamErr } = await db
    .from('Team').select('id').eq('name', 'Origin Point').single()
  if (teamErr || !team) {
    console.error('createGlobalResource: Origin Point team lookup failed', teamErr)
    throw teamErr ?? new Error('Team not found')
  }
  const { data, error } = await db
    .from('Resource')
    .insert({
      id: crypto.randomUUID(),
      teamId: team.id,
      projectId: null,
      folderId: null,
      title: resource.title,
      url: resource.url,
      type: resource.type,
      createdBy: resource.createdBy,
    })
    .select()
    .single()
  if (error) { console.error('createGlobalResource failed:', error); throw error }
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

/**
 * Cross-project chat conversations for the current user. Pulls the most
 * recent messages app-wide (capped) and collapses them into one entry per
 * conversation: one per (projectId, channelId) for channel chats, one per
 * (projectId, partnerId) for DMs involving meId.
 *
 * Sorted by recency. Pre-Auth: meId comes from useMeId()'s placeholder
 * (first ProjectMember row); DMs without meId involvement are skipped.
 */
export async function getAllChats(meId: string | null = null) {
  const db = createClient()
  const { data, error } = await db
    .from('ChatMessage')
    .select(`
      *,
      sender:User!ChatMessage_senderId_fkey(id,name,avatarUrl),
      recipient:User!ChatMessage_recipientId_fkey(id,name,avatarUrl),
      project:Project(id,name,color),
      channel:ChatChannel(id,name)
    `)
    .order('createdAt', { ascending: false })
    .limit(500)
  if (error) { console.error('getAllChats failed:', error); throw error }

  const messages = data ?? []
  const conversations = new Map<string, any>()

  for (const m of messages) {
    if (m.channelId) {
      const key = `c:${m.channelId}`
      if (conversations.has(key)) continue
      conversations.set(key, {
        id: key,
        type: 'channel',
        projectId: m.projectId,
        projectName: (m as any).project?.name ?? 'Project',
        projectColor: (m as any).project?.color ?? null,
        channelId: m.channelId,
        channelName: (m as any).channel?.name ?? 'channel',
        title: `# ${(m as any).channel?.name ?? 'channel'}`,
        lastMessage: m.content,
        lastMessageAt: m.createdAt,
        lastSenderId: m.senderId,
        lastSenderName: (m as any).sender?.name ?? 'Unknown',
        lastSenderAvatar: (m as any).sender?.avatarUrl ?? null,
      })
    } else if (m.recipientId) {
      // DM — only show if meId is involved
      if (!meId || (m.senderId !== meId && m.recipientId !== meId)) continue
      const partnerId = m.senderId === meId ? m.recipientId : m.senderId
      const partner = m.senderId === meId ? (m as any).recipient : (m as any).sender
      const key = `d:${m.projectId}:${partnerId}`
      if (conversations.has(key)) continue
      conversations.set(key, {
        id: key,
        type: 'dm',
        projectId: m.projectId,
        projectName: (m as any).project?.name ?? 'Project',
        projectColor: (m as any).project?.color ?? null,
        partnerId,
        partnerName: partner?.name ?? 'Unknown',
        partnerAvatar: partner?.avatarUrl ?? null,
        title: partner?.name ?? 'Unknown',
        lastMessage: m.content,
        lastMessageAt: m.createdAt,
        lastSenderId: m.senderId,
        lastSenderName: (m as any).sender?.name ?? 'Unknown',
        lastSenderAvatar: (m as any).sender?.avatarUrl ?? null,
      })
    }
  }

  return Array.from(conversations.values()).sort((a, b) =>
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
}

export async function getAllThreads(meId: string | null = null) {
  const db = createClient()
  const { data, error } = await db
    .from('Thread')
    .select('*, ThreadMessage(*), ThreadRead(*)')
    .order('updatedAt', { ascending: false })
  if (error) throw error
  return data.map((t: any) => {
    const messages = t.ThreadMessage ?? []
    const reads = t.ThreadRead ?? []
    const unreadCount = deriveUnreadCount(messages, reads, meId)
    return {
      ...t,
      messages,
      unreadCount,
      unread: unreadCount > 0,
    }
  })
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

// Avatars bucket has permissive RLS pre-Auth (per DECISIONS Apr 27 entry).
// Path convention: {userId}/{rand}.{ext}; random IDs make URLs unguessable.
// On replace, best-effort-deletes the old object so we don't accumulate
// orphan storage objects per user. Updates User.avatarUrl atomically with
// the new public URL — caller doesn't need a separate update call.
const AVATARS_BUCKET = 'avatars'

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const db = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const rand = crypto.randomUUID()
  const path = `${userId}/${rand}.${ext}`

  // Read existing avatarUrl so we can clean up the old object after upload.
  const { data: existing } = await db
    .from('User').select('avatarUrl').eq('id', userId).single()
  const oldUrl = (existing as any)?.avatarUrl as string | null | undefined

  const { error: uploadErr } = await db.storage.from(AVATARS_BUCKET).upload(path, file, {
    contentType: file.type || `image/${ext}`,
    upsert: false,
  })
  if (uploadErr) {
    console.error('uploadAvatar storage failed:', uploadErr)
    if (uploadErr.message?.includes('Bucket not found')) {
      throw new Error('Avatars bucket not configured. Run `pnpm --filter @origin-one/db exec prisma migrate deploy`.')
    }
    if (uploadErr.message?.includes('mime type')) {
      throw new Error('File type not supported. Use PNG, JPEG, or WebP.')
    }
    if (uploadErr.message?.includes('size')) {
      throw new Error('File too large. Maximum 5 MB.')
    }
    throw new Error(uploadErr.message || 'Avatar upload failed. Please try again.')
  }

  const { data: { publicUrl } } = db.storage.from(AVATARS_BUCKET).getPublicUrl(path)

  const { error: updateErr } = await db
    .from('User').update({ avatarUrl: publicUrl }).eq('id', userId)
  if (updateErr) {
    // Best-effort: remove the just-uploaded object so we don't strand it.
    await db.storage.from(AVATARS_BUCKET).remove([path]).catch(() => {})
    console.error('uploadAvatar User.avatarUrl update failed:', updateErr)
    throw new Error(updateErr.message || 'Failed to record avatar.')
  }

  // Clean up the old object — best effort. Orphan storage objects are less
  // bad than missing avatars, so we never throw here.
  if (oldUrl) {
    const match = oldUrl.match(/\/avatars\/(.+)$/)
    if (match) {
      await db.storage.from(AVATARS_BUCKET).remove([match[1]]).catch(() => {})
    }
  }

  return publicUrl
}

export async function removeAvatar(userId: string): Promise<void> {
  const db = createClient()
  const { data: existing } = await db
    .from('User').select('avatarUrl').eq('id', userId).single()
  const oldUrl = (existing as any)?.avatarUrl as string | null | undefined

  if (oldUrl) {
    const match = oldUrl.match(/\/avatars\/(.+)$/)
    if (match) {
      await db.storage.from(AVATARS_BUCKET).remove([match[1]]).catch(() => {})
    }
  }
  const { error } = await db
    .from('User').update({ avatarUrl: null }).eq('id', userId)
  if (error) {
    console.error('removeAvatar update failed:', error)
    throw new Error(error.message || 'Failed to clear avatar.')
  }
}

// Crew Profile v2 (#22) — split mutations because phone is User-global and
// notes/skills are ProjectMember-scoped. Each lands on the right table per
// the DECISIONS "Crew profile fields — global vs project-scoped split" entry.

export async function updateUserPhone(userId: string, phone: string | null): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('User')
    .update({ phone: phone?.trim() || null })
    .eq('id', userId)
  if (error) { console.error('updateUserPhone failed:', error); throw new Error(error.message) }
}

export async function updateProjectMemberProfile(
  projectMemberId: string,
  fields: { notes?: string | null; skills?: string[] },
): Promise<void> {
  const db = createClient()
  const payload: Record<string, any> = {}
  if ('notes' in fields)  payload.notes  = fields.notes?.trim() || null
  if ('skills' in fields) payload.skills = fields.skills ?? []
  if (Object.keys(payload).length === 0) return
  const { error } = await db
    .from('ProjectMember')
    .update(payload)
    .eq('id', projectMemberId)
  if (error) { console.error('updateProjectMemberProfile failed:', error); throw new Error(error.message) }
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
      status: loc.status ?? 'unscouted',
      approved: loc.approved ?? false,
      notes: loc.notes ?? null,
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
  fields: { name?: string; description?: string | null; address?: string | null; keyContact?: string | null; webLink?: string | null; shootDates?: string | null; status?: string; approved?: boolean; notes?: string | null; sceneTab?: string | null; sortOrder?: number }
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

// ── INVENTORY ─────────────────────────────────────────────
// Flat select — assigneeId is a bare ProjectMember.id, the page resolves
// it via useCrew(projectId) and stitches client-side. Same pattern as
// CrewTimecard / ActionItem / Location.
// Order: by department first (groups items in tab views), then sortOrder
// within each department.

export async function getInventoryItems(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('InventoryItem')
    .select('*')
    .eq('projectId', projectId)
    .order('department', { ascending: true })
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return data
}

export async function createInventoryItem(
  item: {
    projectId: string
    name: string
    quantity?: number
    description?: string | null
    department?: string | null
    status?: string
    source?: string | null
    notes?: string | null
    importSource?: string
    assigneeId?: string | null
    sortOrder?: number
  }
) {
  const db = createClient()
  const { data, error } = await db
    .from('InventoryItem')
    .insert({
      id: crypto.randomUUID(),
      projectId: item.projectId,
      name: item.name,
      quantity: item.quantity ?? 1,
      description: item.description ?? null,
      department: item.department ?? null,
      status: item.status ?? 'needed',
      source: item.source ?? null,
      notes: item.notes ?? null,
      importSource: item.importSource ?? 'manual',
      assigneeId: item.assigneeId ?? null,
      sortOrder: item.sortOrder ?? 0,
    })
    .select()
    .single()
  if (error) { console.error('createInventoryItem failed:', error); throw error }
  return data
}

export async function updateInventoryItem(
  id: string,
  fields: {
    name?: string
    quantity?: number
    description?: string | null
    department?: string | null
    status?: string
    source?: string | null
    notes?: string | null
    importSource?: string
    assigneeId?: string | null
    sortOrder?: number
  }
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('InventoryItem')
    .update(fields)
    .eq('id', id)
  if (error) { console.error('updateInventoryItem failed:', error); throw error }
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('InventoryItem').delete().eq('id', id)
  if (error) { console.error('deleteInventoryItem failed:', error); throw error }
}

// ── SHOOT DAYS ───────────────────────────────────────────

export async function getShootDays(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('ShootDay')
    .select('*')
    .eq('projectId', projectId)
    .order('date', { ascending: true })
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return data
}

export async function createShootDay(input: {
  projectId: string
  date: string                  // ISO date 'YYYY-MM-DD'
  type: 'pre' | 'prod' | 'post'
  notes?: string | null
  locationId?: string | null
  sortOrder?: number
}) {
  const db = createClient()
  const { data, error } = await db
    .from('ShootDay')
    .insert({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      date: input.date,
      type: input.type,
      notes: input.notes ?? null,
      locationId: input.locationId ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .select()
    .single()
  if (error) { console.error('createShootDay failed:', error); throw error }
  return data
}

export async function updateShootDay(
  id: string,
  fields: {
    date?: string
    type?: 'pre' | 'prod' | 'post'
    notes?: string | null
    locationId?: string | null
    sortOrder?: number
  }
): Promise<void> {
  const db = createClient()
  const { error } = await db.from('ShootDay').update(fields).eq('id', id)
  if (error) { console.error('updateShootDay failed:', error); throw error }
}

export async function deleteShootDay(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('ShootDay').delete().eq('id', id)
  if (error) { console.error('deleteShootDay failed:', error); throw error }
}

// ── BUDGET ───────────────────────────────────────────────

// One nested query for the entire budget tree + expenses. The page
// computes rolled-up totals client-side via apps/back-to-one/src/lib/
// budget/compute.ts. Returns null when the project has no budget yet
// (5 of 6 seed projects today; only IVV has one).
//
// Performance: this is the only round-trip per budget-page render
// after React Query hydration. Memoize the computed-line array
// downstream — recompute only when active version, variables, or
// expenses change.
export async function getBudgetByProject(projectId: string) {
  const db = createClient()
  const { data, error } = await db
    .from('Budget')
    .select(`
      *,
      versions:BudgetVersion(*),
      accounts:BudgetAccount(*),
      lines:BudgetLine(*, amounts:BudgetLineAmount(*)),
      variables:BudgetVariable(*),
      markups:BudgetMarkup(*),
      expenses:Expense(*)
    `)
    .eq('projectId', projectId)
    .maybeSingle()
  if (error) { console.error('getBudgetByProject failed:', error); throw error }
  return data
}

// Update a BudgetLine — line-level fields. Does NOT touch per-version amounts.
export async function updateBudgetLine(
  id: string,
  patch: {
    description?: string
    accountId?: string
    unit?: 'DAY' | 'WEEK' | 'HOUR' | 'FLAT' | 'UNIT'
    fringeRate?: string
    tags?: string[]
    actualsRate?: string | null
    sortOrder?: number
  },
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('BudgetLine')
    .update({ ...patch, updatedAt: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('updateBudgetLine failed:', error); throw error }
}

// Update a BudgetLineAmount — per-(line, version) qty + rate. qty stays
// a string so formulas like "shootDays * 2" persist. Caller validates
// via evaluate() before save (LineEditTab does this).
export async function updateBudgetLineAmount(
  id: string,
  patch: { qty?: string; rate?: string; notes?: string | null },
): Promise<void> {
  const db = createClient()
  const { error } = await db
    .from('BudgetLineAmount')
    .update({ ...patch, updatedAt: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('updateBudgetLineAmount failed:', error); throw error }
}

// Create a new BudgetLine + BudgetLineAmount rows for every existing
// version (qty='0', rate='0' — producer fills in via the per-version
// cell grid). Returns the new line's id.
//
// Multi-step (insert line → fetch versions → bulk-insert amounts).
// No transaction; tolerable since concurrent budget edits are
// producer-only and rare.
export async function createBudgetLine(input: {
  budgetId: string
  accountId: string
  description: string
  unit: 'DAY' | 'WEEK' | 'HOUR' | 'FLAT' | 'UNIT'
  fringeRate?: string
  sortOrder?: number
  tags?: string[]
  actualsRate?: string | null
}): Promise<string> {
  const db = createClient()
  const lineId = crypto.randomUUID()
  const now = new Date().toISOString()
  const { error: lineErr } = await db.from('BudgetLine').insert({
    id: lineId,
    budgetId:    input.budgetId,
    accountId:   input.accountId,
    description: input.description,
    unit:        input.unit,
    fringeRate:  input.fringeRate ?? '0',
    tags:        input.tags ?? [],
    actualsRate: input.actualsRate ?? null,
    sortOrder:   input.sortOrder ?? 0,
    updatedAt:   now,
  })
  if (lineErr) { console.error('createBudgetLine line insert failed:', lineErr); throw lineErr }

  const versionsResp = await db
    .from('BudgetVersion').select('id').eq('budgetId', input.budgetId)
  if (versionsResp.error) {
    console.error('createBudgetLine versions fetch failed:', versionsResp.error)
    throw versionsResp.error
  }
  const versions = (versionsResp.data ?? []) as { id: string }[]
  if (versions.length > 0) {
    const amountRows = versions.map(v => ({
      id: crypto.randomUUID(),
      lineId,
      versionId: v.id,
      qty: '0',
      rate: '0',
      notes: null,
      updatedAt: now,
    }))
    const { error: amtErr } = await db.from('BudgetLineAmount').insert(amountRows)
    if (amtErr) { console.error('createBudgetLine amounts insert failed:', amtErr); throw amtErr }
  }
  return lineId
}

// Create a manual Expense row. Receipt photo upload lands in PR 14.
export async function createManualExpense(input: {
  budgetId: string
  lineId: string
  amount: string
  date: string                         // ISO 'YYYY-MM-DD'
  vendor?: string | null
  notes?: string | null
  receiptUrl?: string | null           // Storage path in receipts bucket
  createdBy: string                    // ProjectMember.id pre-Auth
}): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Expense').insert({
    id: crypto.randomUUID(),
    budgetId:   input.budgetId,
    lineId:     input.lineId,
    source:     'manual',
    amount:     input.amount,
    date:       input.date,
    units:      null,
    unitRate:   null,
    unit:       null,
    vendor:     input.vendor ?? null,
    notes:      input.notes ?? null,
    receiptUrl: input.receiptUrl ?? null,
    timecardId: null,
    createdBy:  input.createdBy,
    updatedAt:  new Date().toISOString(),
  })
  if (error) { console.error('createManualExpense failed:', error); throw error }
}

// Update a BudgetVersion — name, state, lock metadata. Lock transitions
// stamp lockedAt/lockedBy; unlock clears them.
export async function updateBudgetVersion(
  id: string,
  patch: {
    name?: string
    state?: 'draft' | 'locked'
    lockedBy?: string | null            // ProjectMember.id when locking
  },
): Promise<void> {
  const db = createClient()
  const fields: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (patch.name !== undefined) fields.name = patch.name
  if (patch.state !== undefined) {
    fields.state = patch.state
    if (patch.state === 'locked') {
      fields.lockedAt = new Date().toISOString()
      fields.lockedBy = patch.lockedBy ?? null
    } else {
      fields.lockedAt = null
      fields.lockedBy = null
    }
  } else if (patch.lockedBy !== undefined) {
    fields.lockedBy = patch.lockedBy
  }
  const { error } = await db.from('BudgetVersion').update(fields).eq('id', id)
  if (error) { console.error('updateBudgetVersion failed:', error); throw error }
}

// Duplicate a BudgetVersion — new BudgetVersion(kind='other') + deep-copy
// every BudgetLineAmount from the source version. Variables and markups
// scoped to the source version are NOT copied — keep the duplicate a
// clean rate/qty starting point. Returns the new version id.
export async function duplicateBudgetVersion(
  srcVersionId: string,
  name: string,
): Promise<string> {
  const db = createClient()
  const srcResp = await db
    .from('BudgetVersion').select('*').eq('id', srcVersionId).maybeSingle()
  if (srcResp.error || !srcResp.data) {
    console.error('duplicateBudgetVersion source fetch failed:', srcResp.error)
    throw srcResp.error ?? new Error('Source version not found')
  }
  const src = srcResp.data as { id: string; budgetId: string; sortOrder: number }

  const maxResp = await db
    .from('BudgetVersion').select('sortOrder').eq('budgetId', src.budgetId)
    .order('sortOrder', { ascending: false }).limit(1).maybeSingle()
  const nextSort = ((maxResp.data as { sortOrder: number } | null)?.sortOrder ?? src.sortOrder) + 1

  const newId = crypto.randomUUID()
  const now = new Date().toISOString()
  const { error: insErr } = await db.from('BudgetVersion').insert({
    id: newId,
    budgetId: src.budgetId,
    name,
    kind: 'other',
    sortOrder: nextSort,
    state: 'draft',
    lockedAt: null,
    lockedBy: null,
    updatedAt: now,
  })
  if (insErr) { console.error('duplicateBudgetVersion insert failed:', insErr); throw insErr }

  const amountsResp = await db
    .from('BudgetLineAmount').select('lineId, qty, rate, notes').eq('versionId', srcVersionId)
  if (amountsResp.error) {
    console.error('duplicateBudgetVersion amounts fetch failed:', amountsResp.error)
    throw amountsResp.error
  }
  const srcAmounts = (amountsResp.data ?? []) as { lineId: string; qty: string; rate: string; notes: string | null }[]
  if (srcAmounts.length > 0) {
    const newAmounts = srcAmounts.map(a => ({
      id: crypto.randomUUID(),
      lineId: a.lineId,
      versionId: newId,
      qty: a.qty,
      rate: a.rate,
      notes: a.notes,
      updatedAt: now,
    }))
    const { error: copyErr } = await db.from('BudgetLineAmount').insert(newAmounts)
    if (copyErr) { console.error('duplicateBudgetVersion amounts insert failed:', copyErr); throw copyErr }
  }
  return newId
}

// Delete a BudgetVersion. Refuses to delete the last remaining version
// for a budget — a budget must always have at least one. Cascading
// BudgetLineAmount / BudgetVariable / BudgetMarkup rows tied to this
// version are removed by Postgres ON DELETE CASCADE (PR 4 schema).
export async function deleteBudgetVersion(id: string): Promise<void> {
  const db = createClient()
  const versionResp = await db
    .from('BudgetVersion').select('budgetId').eq('id', id).maybeSingle()
  if (versionResp.error || !versionResp.data) {
    console.error('deleteBudgetVersion lookup failed:', versionResp.error)
    throw versionResp.error ?? new Error('Version not found')
  }
  const { budgetId } = versionResp.data as { budgetId: string }
  const countResp = await db
    .from('BudgetVersion').select('id', { count: 'exact', head: true }).eq('budgetId', budgetId)
  if ((countResp.count ?? 0) <= 1) {
    throw new Error('Cannot delete the last version — a budget must always have at least one version.')
  }
  const { error } = await db.from('BudgetVersion').delete().eq('id', id)
  if (error) { console.error('deleteBudgetVersion failed:', error); throw error }
}

// Helper — insert the standard 3-version starter set onto a freshly
// created Budget. Returns the created versions in sortOrder.
async function insertStandardVersions(
  db: ReturnType<typeof createClient>,
  budgetId: string,
): Promise<{ id: string; kind: 'estimate' | 'working' | 'committed' }[]> {
  const now = new Date().toISOString()
  const versions = [
    { id: crypto.randomUUID(), budgetId, name: 'Estimate',  kind: 'estimate'  as const, sortOrder: 1, state: 'draft', updatedAt: now },
    { id: crypto.randomUUID(), budgetId, name: 'Working',   kind: 'working'   as const, sortOrder: 2, state: 'draft', updatedAt: now },
    { id: crypto.randomUUID(), budgetId, name: 'Committed', kind: 'committed' as const, sortOrder: 3, state: 'draft', updatedAt: now },
  ]
  const { error } = await db.from('BudgetVersion').insert(versions)
  if (error) { console.error('insertStandardVersions failed:', error); throw error }
  return versions.map(v => ({ id: v.id, kind: v.kind }))
}

// Create a fresh budget from the AICP template — Budget + 3 versions +
// 14 accounts (DEFAULT_AICP_ACCOUNTS fixture, single source of truth)
// + 2 default markups (Contingency 10% on the Insurance · Misc account
// subtotal, Agency Fee 5% on grand total). Mirrors the IVV seed shape
// minus lines/expenses.
//
// Multi-step (Budget → Versions → Accounts → Markups). No transactions
// in the Supabase client path; tolerable since concurrent budget
// creation on the same project is producer-only and rare. rateSourceVersionId
// is set to the Committed version after creation (committed > working > estimate
// per spec §3.1).
export async function createBudgetFromTemplate(input: {
  projectId: string
  currency: string
  varianceThreshold: string                   // Decimal(5,4) string, e.g. '0.10'
}): Promise<string> {
  const db = createClient()
  const budgetId = crypto.randomUUID()
  const now = new Date().toISOString()

  // 1. Budget shell.
  const { error: budErr } = await db.from('Budget').insert({
    id: budgetId,
    projectId:           input.projectId,
    currency:            input.currency,
    varianceThreshold:   input.varianceThreshold,
    rateSourceVersionId: null,                  // set after versions created
    clonedFromProjectId: null,
    updatedAt:           now,
  })
  if (budErr) { console.error('createBudgetFromTemplate budget failed:', budErr); throw budErr }

  // 2. Three versions (Estimate / Working / Committed).
  const versions = await insertStandardVersions(db, budgetId)
  const committed = versions.find(v => v.kind === 'committed')!
  await db.from('Budget').update({ rateSourceVersionId: committed.id }).eq('id', budgetId)

  // 3. 14 AICP accounts from the shared fixture.
  const accountRows = DEFAULT_AICP_ACCOUNTS.map(a => ({
    id: crypto.randomUUID(),
    budgetId,
    parentId:  null,
    section:   a.section,
    code:      a.code,
    name:      a.name,
    sortOrder: a.sortOrder,
    updatedAt: now,
  }))
  const { error: accErr } = await db.from('BudgetAccount').insert(accountRows)
  if (accErr) { console.error('createBudgetFromTemplate accounts failed:', accErr); throw accErr }

  // 4. Two default markups — versionId=null applies to all versions.
  //    Both target grand total: Contingency 10% + Agency Fee 5%. Schema
  //    lacks a sectionSubtotal MarkupTarget, so the closest match to
  //    "10% of the full budget" is grandTotal (account L would only
  //    cover Insurance · Misc, ~$500 instead of producer-expected ~$20K).
  //    Producer can rescope via PR 12 settings.
  const markupRows = [
    {
      id: crypto.randomUUID(), budgetId, versionId: null,
      name: 'Contingency', percent: '0.10',
      appliesTo: 'grandTotal' as const,
      accountId: null,
      sortOrder: 1, updatedAt: now,
    },
    {
      id: crypto.randomUUID(), budgetId, versionId: null,
      name: 'Agency Fee', percent: '0.05',
      appliesTo: 'grandTotal' as const,
      accountId: null,
      sortOrder: 2, updatedAt: now,
    },
  ]
  const { error: mkErr } = await db.from('BudgetMarkup').insert(markupRows)
  if (mkErr) { console.error('createBudgetFromTemplate markups failed:', mkErr); throw mkErr }

  return budgetId
}

// Create a blank budget — Budget + 3 versions only. No accounts, no
// markups, no variables. Producer builds from scratch.
export async function createBlankBudget(input: {
  projectId: string
  currency: string
  varianceThreshold: string
}): Promise<string> {
  const db = createClient()
  const budgetId = crypto.randomUUID()
  const now = new Date().toISOString()

  const { error: budErr } = await db.from('Budget').insert({
    id: budgetId,
    projectId:           input.projectId,
    currency:            input.currency,
    varianceThreshold:   input.varianceThreshold,
    rateSourceVersionId: null,
    clonedFromProjectId: null,
    updatedAt:           now,
  })
  if (budErr) { console.error('createBlankBudget budget failed:', budErr); throw budErr }

  const versions = await insertStandardVersions(db, budgetId)
  const committed = versions.find(v => v.kind === 'committed')!
  await db.from('Budget').update({ rateSourceVersionId: committed.id }).eq('id', budgetId)

  return budgetId
}

// Clone-from-prior — deep copy via Supabase client.
//
// Codebase fit: cloneBudget() in @origin-one/db (PR 7) is the design
// intent, but it imports PrismaClient — back-to-one runs on Supabase
// client only (DATABASE_URL not in apps/back-to-one/.env.local). Rather
// than spread DB credentials across env files OR add a Next.js API
// route just for this op, the clone is implemented here using the same
// browser Supabase client that powers every other write path. The seed
// path (packages/db/prisma/seed.ts) can still call the Prisma helper.
//
// Topological pass for accounts (parent before child) ports the same
// utility from clone-budget.ts. Expenses are NOT cloned (spec §7.2).
export async function createBudgetByClone(input: {
  srcProjectId: string
  targetProjectId: string
}): Promise<string> {
  const db = createClient()
  const now = new Date().toISOString()

  // 1. Source budget tree (one nested fetch).
  const srcResp = await db
    .from('Budget')
    .select(`
      *,
      versions:BudgetVersion(*),
      accounts:BudgetAccount(*),
      lines:BudgetLine(*, amounts:BudgetLineAmount(*)),
      variables:BudgetVariable(*),
      markups:BudgetMarkup(*)
    `)
    .eq('projectId', input.srcProjectId)
    .maybeSingle()
  if (srcResp.error || !srcResp.data) {
    console.error('createBudgetByClone source fetch failed:', srcResp.error)
    throw srcResp.error ?? new Error('Source project has no budget to clone')
  }
  const src = srcResp.data as {
    currency: string
    varianceThreshold: string
    rateSourceVersionId: string | null
    versions: { id: string; name: string; kind: 'estimate' | 'working' | 'committed' | 'other'; sortOrder: number; state: 'draft' | 'locked' }[]
    accounts: { id: string; parentId: string | null; section: 'ATL' | 'BTL'; code: string; name: string; sortOrder: number }[]
    lines: { id: string; accountId: string; description: string; unit: string; fringeRate: string; tags: string[]; actualsRate: string | null; sortOrder: number; amounts: { versionId: string; qty: string; rate: string; notes: string | null }[] }[]
    variables: { versionId: string | null; name: string; value: string; notes: string | null }[]
    markups: { versionId: string | null; name: string; percent: string; appliesTo: 'grandTotal' | 'accountSubtotal'; accountId: string | null; sortOrder: number }[]
  }

  // 2. New Budget shell — clonedFromProjectId set for traceability.
  const newBudgetId = crypto.randomUUID()
  const { error: budErr } = await db.from('Budget').insert({
    id: newBudgetId,
    projectId:           input.targetProjectId,
    currency:            src.currency,
    varianceThreshold:   src.varianceThreshold,
    rateSourceVersionId: null,
    clonedFromProjectId: input.srcProjectId,
    updatedAt:           now,
  })
  if (budErr) { console.error('createBudgetByClone budget failed:', budErr); throw budErr }

  // 3. Versions — drop lock metadata (clones start unlocked).
  const versionIdByOld = new Map<string, string>()
  const newVersionRows = src.versions.map(v => {
    const newId = crypto.randomUUID()
    versionIdByOld.set(v.id, newId)
    return {
      id: newId, budgetId: newBudgetId,
      name: v.name, kind: v.kind, sortOrder: v.sortOrder,
      state: 'draft' as const, lockedAt: null, lockedBy: null,
      updatedAt: now,
    }
  })
  if (newVersionRows.length > 0) {
    const { error } = await db.from('BudgetVersion').insert(newVersionRows)
    if (error) { console.error('createBudgetByClone versions failed:', error); throw error }
  }
  if (src.rateSourceVersionId) {
    const newRateSource = versionIdByOld.get(src.rateSourceVersionId)
    if (newRateSource) {
      await db.from('Budget').update({ rateSourceVersionId: newRateSource }).eq('id', newBudgetId)
    }
  }

  // 4. Accounts — topological pass (parent before child).
  const accountIdByOld = new Map<string, string>()
  const sortedAccounts = topologicalAccountsLocal(src.accounts)
  const newAccountRows = sortedAccounts.map(a => {
    const newId = crypto.randomUUID()
    accountIdByOld.set(a.id, newId)
    return {
      id: newId, budgetId: newBudgetId,
      parentId: a.parentId ? accountIdByOld.get(a.parentId) ?? null : null,
      section: a.section, code: a.code, name: a.name, sortOrder: a.sortOrder,
      updatedAt: now,
    }
  })
  if (newAccountRows.length > 0) {
    const { error } = await db.from('BudgetAccount').insert(newAccountRows)
    if (error) { console.error('createBudgetByClone accounts failed:', error); throw error }
  }

  // 5. Lines + amounts.
  if (src.lines.length > 0) {
    const newLineRows: Array<Record<string, unknown>> = []
    const newAmountRows: Array<Record<string, unknown>> = []
    for (const line of src.lines) {
      const newLineId = crypto.randomUUID()
      const newAccountId = accountIdByOld.get(line.accountId)
      if (!newAccountId) continue
      newLineRows.push({
        id: newLineId, budgetId: newBudgetId,
        accountId: newAccountId,
        description: line.description, unit: line.unit, fringeRate: line.fringeRate,
        tags: line.tags, actualsRate: line.actualsRate, sortOrder: line.sortOrder,
        updatedAt: now,
      })
      for (const amt of line.amounts) {
        const newVersionId = versionIdByOld.get(amt.versionId)
        if (!newVersionId) continue
        newAmountRows.push({
          id: crypto.randomUUID(),
          lineId: newLineId, versionId: newVersionId,
          qty: amt.qty, rate: amt.rate, notes: amt.notes,
          updatedAt: now,
        })
      }
    }
    if (newLineRows.length > 0) {
      const { error } = await db.from('BudgetLine').insert(newLineRows)
      if (error) { console.error('createBudgetByClone lines failed:', error); throw error }
    }
    if (newAmountRows.length > 0) {
      const { error } = await db.from('BudgetLineAmount').insert(newAmountRows)
      if (error) { console.error('createBudgetByClone amounts failed:', error); throw error }
    }
  }

  // 6. Variables.
  if (src.variables.length > 0) {
    const newVariableRows = src.variables.map(v => ({
      id: crypto.randomUUID(),
      budgetId: newBudgetId,
      versionId: v.versionId ? versionIdByOld.get(v.versionId) ?? null : null,
      name: v.name, value: v.value, notes: v.notes,
      updatedAt: now,
    }))
    const { error } = await db.from('BudgetVariable').insert(newVariableRows)
    if (error) { console.error('createBudgetByClone variables failed:', error); throw error }
  }

  // 7. Markups.
  if (src.markups.length > 0) {
    const newMarkupRows = src.markups.map(m => ({
      id: crypto.randomUUID(),
      budgetId: newBudgetId,
      versionId: m.versionId ? versionIdByOld.get(m.versionId) ?? null : null,
      accountId: m.accountId ? accountIdByOld.get(m.accountId) ?? null : null,
      name: m.name, percent: m.percent, appliesTo: m.appliesTo, sortOrder: m.sortOrder,
      updatedAt: now,
    }))
    const { error } = await db.from('BudgetMarkup').insert(newMarkupRows)
    if (error) { console.error('createBudgetByClone markups failed:', error); throw error }
  }

  // Expenses are intentionally NOT cloned (spec §7.2 — actuals are
  // real-world data, not template).
  return newBudgetId
}

// Local topological sort — same algorithm as topologicalAccounts() in
// @origin-one/db/src/clone-budget.ts. Inlined to keep the Supabase
// path self-contained.
function topologicalAccountsLocal<T extends { id: string; parentId: string | null }>(rows: T[]): T[] {
  const sorted: T[] = []
  const remaining = [...rows]
  const placed = new Set<string>()
  while (remaining.length > 0) {
    const i = remaining.findIndex(r => !r.parentId || placed.has(r.parentId))
    if (i < 0) throw new Error('createBudgetByClone: cycle (or dangling parentId) in account tree')
    const [next] = remaining.splice(i, 1)
    sorted.push(next)
    placed.add(next.id)
  }
  return sorted
}

// List of projects in the team that have a budget — for the clone source
// picker. Excludes the current project (caller filters).
export async function getProjectsWithBudgets() {
  const db = createClient()
  const { data, error } = await db
    .from('Project')
    .select(`
      id, name, color, status,
      budget:Budget(id, clonedFromProjectId)
    `)
    .neq('status', 'archived')
    .order('createdAt', { ascending: false })
  if (error) { console.error('getProjectsWithBudgets failed:', error); throw error }
  // Supabase returns `budget` as either an object or null; some configs
  // return an array. Normalize to "has budget?" by checking truthiness.
  type Row = { id: string; name: string; color: string | null; status: string; budget: unknown }
  return (data as Row[] ?? [])
    .filter(p => {
      if (Array.isArray(p.budget)) return p.budget.length > 0
      return p.budget != null
    })
    .map(p => ({ id: p.id, name: p.name, color: p.color, status: p.status }))
}

// PR 12 — settings sheet mutations.

// Producer-editable Budget patch — variance threshold, rate source.
// Currency is locked at v1; not exposed in this patch shape.
export async function updateBudget(
  budgetId: string,
  patch: { varianceThreshold?: string; rateSourceVersionId?: string | null },
): Promise<void> {
  const db = createClient()
  const fields: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (patch.varianceThreshold !== undefined) fields.varianceThreshold = patch.varianceThreshold
  if (patch.rateSourceVersionId !== undefined) fields.rateSourceVersionId = patch.rateSourceVersionId
  const { error } = await db.from('Budget').update(fields).eq('id', budgetId)
  if (error) { console.error('updateBudget failed:', error); throw error }
}

// Hard delete a Budget. Postgres ON DELETE CASCADE (PR 4 schema)
// removes BudgetVersion / BudgetAccount / BudgetLine / BudgetLineAmount
// / BudgetVariable / BudgetMarkup rows. Manual Expenses on the project
// are detached (Expense.budgetLineId nullable per PR 4); they are NOT
// deleted with the budget — they outlive the chart of accounts.
export async function deleteBudget(budgetId: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Budget').delete().eq('id', budgetId)
  if (error) { console.error('deleteBudget failed:', error); throw error }
}

// Markup CRUD. accountId is required when appliesTo='accountSubtotal'
// (validated at call site; the DB has a CHECK constraint per PR 4 too).
export async function createBudgetMarkup(input: {
  budgetId: string
  versionId: string | null
  name: string
  percent: string                       // Decimal(5,4) — '0.10' for 10%
  appliesTo: 'grandTotal' | 'accountSubtotal'
  accountId: string | null
  sortOrder: number
}): Promise<string> {
  const db = createClient()
  const id = crypto.randomUUID()
  const { error } = await db.from('BudgetMarkup').insert({
    id, ...input, updatedAt: new Date().toISOString(),
  })
  if (error) { console.error('createBudgetMarkup failed:', error); throw error }
  return id
}

export async function updateBudgetMarkup(
  id: string,
  patch: {
    name?: string
    percent?: string
    appliesTo?: 'grandTotal' | 'accountSubtotal'
    accountId?: string | null
    versionId?: string | null
    sortOrder?: number
  },
): Promise<void> {
  const db = createClient()
  const fields: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (patch.name !== undefined)       fields.name = patch.name
  if (patch.percent !== undefined)    fields.percent = patch.percent
  if (patch.appliesTo !== undefined)  fields.appliesTo = patch.appliesTo
  if (patch.accountId !== undefined)  fields.accountId = patch.accountId
  if (patch.versionId !== undefined)  fields.versionId = patch.versionId
  if (patch.sortOrder !== undefined)  fields.sortOrder = patch.sortOrder
  const { error } = await db.from('BudgetMarkup').update(fields).eq('id', id)
  if (error) { console.error('updateBudgetMarkup failed:', error); throw error }
}

export async function deleteBudgetMarkup(id: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('BudgetMarkup').delete().eq('id', id)
  if (error) { console.error('deleteBudgetMarkup failed:', error); throw error }
}

// ── ENTITIES (characters, locations, props) ──────────────

export async function getEntities(projectId: string, type?: 'character' | 'location' | 'prop') {
  const db = createClient()
  let q = db.from('Entity').select('*').eq('projectId', projectId).order('createdAt', { ascending: true })
  if (type) q = q.eq('type', type)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createEntity(entity: {
  projectId: string; type: 'character' | 'location' | 'prop'; name: string; description?: string; metadata?: Record<string, any>
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
        initials: initials(t.name ?? '', '+'),
        imageUrl: t.imageUrl ?? null,
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
  // Pull paired production-side rows alongside the Entity:
  //   props    → PropSourced     (status: PropStatus, isHero: Boolean)
  //   wardrobe → WardrobeSourced  (status: WardrobeStatus)
  //   hmu      → still on Entity.metadata.status until HmuSourced ships
  const { data, error } = await db
    .from('Entity')
    .select('*, PropSourced(*), WardrobeSourced(*)')
    .eq('projectId', projectId)
    .in('type', ['prop', 'wardrobe', 'hmu'])
    // Seed inserts art items via a single createMany, so all rows share the
    // same createdAt. Add id as a deterministic tiebreaker so any future
    // UPDATE on a tied row can't re-shuffle its position in the tab.
    .order('createdAt', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

// PropSourced / WardrobeSourced mutation helpers — called from the Art page
// when the user changes a prop's status, toggles its hero flag, or changes a
// wardrobe item's status. All ops are upserts keyed by entityId so newly-
// created entities (which don't have a sourced row yet) get one created on
// first edit.
export async function upsertPropSourced(
  entityId: string,
  projectId: string,
  fields: { status?: 'needed' | 'sourced' | 'ready'; isHero?: boolean },
): Promise<void> {
  const db = createClient()
  const { data: existing, error: readErr } = await db
    .from('PropSourced').select('id').eq('entityId', entityId).maybeSingle()
  if (readErr) { console.error('upsertPropSourced read failed:', readErr); throw readErr }
  if (existing?.id) {
    const { error } = await db
      .from('PropSourced')
      .update({ ...fields, updatedAt: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) { console.error('upsertPropSourced update failed:', error); throw error }
  } else {
    const { error } = await db
      .from('PropSourced')
      .insert({
        id: crypto.randomUUID(),
        projectId,
        entityId,
        status: fields.status ?? 'needed',
        isHero: fields.isHero ?? false,
        updatedAt: new Date().toISOString(),
      })
    if (error) { console.error('upsertPropSourced insert failed:', error); throw error }
  }
}

export async function upsertWardrobeSourced(
  entityId: string,
  projectId: string,
  fields: { status?: 'needed' | 'sourced' | 'fitted' | 'ready' },
): Promise<void> {
  const db = createClient()
  const { data: existing, error: readErr } = await db
    .from('WardrobeSourced').select('id').eq('entityId', entityId).maybeSingle()
  if (readErr) { console.error('upsertWardrobeSourced read failed:', readErr); throw readErr }
  if (existing?.id) {
    const { error } = await db
      .from('WardrobeSourced')
      .update({ ...fields, updatedAt: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) { console.error('upsertWardrobeSourced update failed:', error); throw error }
  } else {
    const { error } = await db
      .from('WardrobeSourced')
      .insert({
        id: crypto.randomUUID(),
        projectId,
        entityId,
        status: fields.status ?? 'needed',
        updatedAt: new Date().toISOString(),
      })
    if (error) { console.error('upsertWardrobeSourced insert failed:', error); throw error }
  }
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

// ── CREW TIMECARDS ───────────────────────────────────────

// Fetch all timecard rows for a project within an inclusive date range.
// Returns raw CrewTimecard rows (no joined ProjectMember) — the caller
// already has ProjectMember data via useCrew() and joins client-side.
export async function getCrewTimecardsByWeek(
  projectId: string,
  weekStartISO: string,  // YYYY-MM-DD, inclusive
  weekEndISO: string,    // YYYY-MM-DD, inclusive
) {
  const db = createClient()
  const { data, error } = await db
    .from('CrewTimecard')
    .select('*')
    .eq('projectId', projectId)
    .gte('date', weekStartISO)
    .lte('date', weekEndISO)
    .order('date', { ascending: true })
  if (error) { console.error('getCrewTimecardsByWeek failed:', error); throw error }
  return data
}

// Create a new timecard entry in 'draft' state. Server defaults apply for
// timestamps and status; we supply only the user-entered fields + identity.
// rate is optional — null/undefined both store NULL.
// rateUnit: 'day' | 'hour' — defaults to 'hour' when not specified, which
// matches the form's default-value choice in EntryCard. Math fix that
// consumes this enum lands in PR 6 of the budget arc.
export async function createTimecard(input: {
  projectId: string
  crewMemberId: string
  date: string           // YYYY-MM-DD
  hours: number
  rate?: number | null   // nullable per schema; absent = NULL
  rateUnit?: 'day' | 'hour'   // defaults to 'hour' for new entries
  description: string
}) {
  const db = createClient()
  const { data, error } = await db
    .from('CrewTimecard')
    .insert({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      crewMemberId: input.crewMemberId,
      date: input.date,
      hours: input.hours,
      rate: input.rate ?? null,
      rateUnit: input.rateUnit ?? 'hour',
      description: input.description,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) { console.error('createTimecard failed:', error); throw error }
  return data
}

// Edit hours/description/rate/rateUnit on an existing entry. Called for draft
// and reopened entries; the UI enforces the allowed-state rule, server is
// permissive. Pass rate: null to clear an existing rate, omit to leave
// unchanged. Same omit-to-skip semantics for rateUnit.
export async function updateTimecard(
  id: string,
  fields: { hours?: number; rate?: number | null; rateUnit?: 'day' | 'hour'; description?: string },
) {
  const db = createClient()
  const { error } = await db
    .from('CrewTimecard')
    .update({ ...fields, updatedAt: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('updateTimecard failed:', error); throw error }
}

// draft → submitted. Crew clicks "Submit" on a draft (or a reopened entry
// after editing) to move it into producer's approval queue.
export async function submitTimecard(id: string): Promise<void> {
  const db = createClient()
  const now = new Date().toISOString()
  const { error } = await db
    .from('CrewTimecard')
    .update({ status: 'submitted', submittedAt: now, updatedAt: now })
    .eq('id', id)
  if (error) { console.error('submitTimecard failed:', error); throw error }
}

// submitted → approved. Producer clicks "Approve" on a submitted entry.
// approvedBy is the producer's ProjectMember.id (not User.id) per schema.
//
// Side-effect: materializes a paired Expense row in the project's Budget
// (if one exists). Idempotent via Expense.timecardId @unique. Sync runs
// after the status update — sync failures don't roll back the approval.
export async function approveTimecard(id: string, approvedBy: string): Promise<void> {
  const db = createClient()
  const now = new Date().toISOString()
  const { error } = await db
    .from('CrewTimecard')
    .update({ status: 'approved', approvedAt: now, approvedBy, updatedAt: now })
    .eq('id', id)
  if (error) { console.error('approveTimecard failed:', error); throw error }
  await syncExpenseFromTimecard(id)
}

// any → reopened. Producer clicks "Reopen" on an approved/submitted entry
// and provides a reason. Existing approvedBy/approvedAt are preserved so the
// record still carries "was approved by X" context; reopen fields layer on.
//
// Side-effect: deletes the paired Expense row (if any). The Expense will
// be re-created when the timecard is re-approved. No-throw on failure.
export async function reopenTimecard(
  id: string,
  reopenedBy: string,
  reopenReason: string,
): Promise<void> {
  const db = createClient()
  const now = new Date().toISOString()
  const { error } = await db
    .from('CrewTimecard')
    .update({
      status: 'reopened',
      reopenedAt: now,
      reopenedBy,
      reopenReason,
      updatedAt: now,
    })
    .eq('id', id)
  if (error) { console.error('reopenTimecard failed:', error); throw error }
  await deleteExpenseForTimecard(id)
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

// ── PROJECT-SELECTION FOLDERS (per-user) ──────────────────

export async function getUserProjectFolders(meId: string | null) {
  if (!meId) return []
  const db = createClient()
  const { data, error } = await db
    .from('UserProjectFolder')
    .select('*')
    .eq('userId', meId)
    .eq('archived', false)
    .order('sortOrder', { ascending: true })
  if (error) { console.error('getUserProjectFolders failed:', error); throw error }
  return data ?? []
}

export async function getArchivedUserProjectFolders(meId: string | null) {
  if (!meId) return []
  const db = createClient()
  const { data, error } = await db
    .from('UserProjectFolder')
    .select('*')
    .eq('userId', meId)
    .eq('archived', true)
    .order('sortOrder', { ascending: true })
  if (error) { console.error('getArchivedUserProjectFolders failed:', error); throw error }
  return data ?? []
}

// Archives a folder (marks archived=true) AND archives every project whose
// placement points at it. The folder row + its placements stay intact so the
// archive view can render the folder with its projects inside.
export async function archiveUserProjectFolder(meId: string, folderId: string) {
  const db = createClient()
  const { data: placements, error: pErr } = await db
    .from('UserProjectPlacement')
    .select('projectId')
    .eq('userId', meId)
    .eq('folderId', folderId)
  if (pErr) { console.error('archiveUserProjectFolder placements failed:', pErr); throw pErr }
  const projectIds = (placements ?? []).map(p => p.projectId)
  if (projectIds.length > 0) {
    const { error: aErr } = await db
      .from('Project')
      .update({ status: 'archived' })
      .in('id', projectIds)
    if (aErr) { console.error('archiveUserProjectFolder cascade failed:', aErr); throw aErr }
  }
  const { error: fErr } = await db
    .from('UserProjectFolder')
    .update({ archived: true, updatedAt: new Date().toISOString() })
    .eq('id', folderId)
  if (fErr) { console.error('archiveUserProjectFolder folder failed:', fErr); throw fErr }
}

// Restores a folder back to the home grid AND restores every archived project
// whose placement points at it. Mirrors archiveUserProjectFolder.
export async function restoreUserProjectFolder(meId: string, folderId: string) {
  const db = createClient()
  const { data: placements, error: pErr } = await db
    .from('UserProjectPlacement')
    .select('projectId')
    .eq('userId', meId)
    .eq('folderId', folderId)
  if (pErr) { console.error('restoreUserProjectFolder placements failed:', pErr); throw pErr }
  const projectIds = (placements ?? []).map(p => p.projectId)
  if (projectIds.length > 0) {
    const { error: rErr } = await db
      .from('Project')
      .update({ status: 'post_production' })
      .in('id', projectIds)
    if (rErr) { console.error('restoreUserProjectFolder cascade failed:', rErr); throw rErr }
  }
  const { error: fErr } = await db
    .from('UserProjectFolder')
    .update({ archived: false, updatedAt: new Date().toISOString() })
    .eq('id', folderId)
  if (fErr) { console.error('restoreUserProjectFolder folder failed:', fErr); throw fErr }
}

export async function getUserProjectPlacements(meId: string | null) {
  if (!meId) return []
  const db = createClient()
  const { data, error } = await db
    .from('UserProjectPlacement')
    .select('*')
    .eq('userId', meId)
  if (error) { console.error('getUserProjectPlacements failed:', error); throw error }
  return data ?? []
}

export async function createUserProjectFolder(input: {
  userId: string; name?: string; color?: string | null; sortOrder?: number
}) {
  const db = createClient()
  // Pass updatedAt explicitly — Prisma's @updatedAt is client-side only,
  // so direct PostgREST inserts must supply a value. createdAt has a DB
  // default but supplying it keeps the two timestamps coherent.
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('UserProjectFolder')
    .insert({
      userId: input.userId,
      name: input.name ?? 'Untitled',
      color: input.color ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single()
  if (error) { console.error('createUserProjectFolder failed:', error); throw error }
  return data
}

// Pre-Auth: caller is trusted; no userId scope. Tightens to .eq('userId', meId) on Auth-day RLS pass.
export async function updateUserProjectFolder(
  id: string,
  fields: { name?: string; color?: string | null; sortOrder?: number }
) {
  const db = createClient()
  const { error } = await db.from('UserProjectFolder').update(fields).eq('id', id)
  if (error) { console.error('updateUserProjectFolder failed:', error); throw error }
}

// Pre-Auth: caller is trusted; no userId scope. Tightens to .eq('userId', meId) on Auth-day RLS pass.
export async function deleteUserProjectFolder(id: string) {
  const db = createClient()
  const { error } = await db.from('UserProjectFolder').delete().eq('id', id)
  if (error) { console.error('deleteUserProjectFolder failed:', error); throw error }
}

/**
 * Insert-or-update a placement for (userId, projectId). Upsert on the
 * unique (userId, projectId) constraint — every drag-into / drag-out /
 * top-level reorder writes through here.
 */
export async function upsertUserProjectPlacement(input: {
  userId: string; projectId: string; folderId?: string | null; sortOrder?: number
}) {
  const db = createClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('UserProjectPlacement')
    .upsert({
      userId: input.userId,
      projectId: input.projectId,
      folderId: input.folderId ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    }, { onConflict: 'userId,projectId' })
    .select()
    .single()
  if (error) { console.error('upsertUserProjectPlacement failed:', error); throw error }
  return data
}

/** Bulk reorder for a single home-grid pass (all top-level items). */
export async function bulkReorderHomeGrid(
  meId: string,
  items: { type: 'folder' | 'project'; id: string; sortOrder: number }[]
) {
  const db = createClient()
  const folders = items.filter(i => i.type === 'folder')
  const projects = items.filter(i => i.type === 'project')

  // Per-row update (Supabase doesn't support multi-row UPDATE with different
  // values in one call). PostgREST returns { error } per row instead of
  // throwing — collect responses and surface the first error so a partial
  // failure doesn't silently masquerade as success.
  const now = new Date().toISOString()
  if (folders.length > 0) {
    const results = await Promise.all(folders.map(f =>
      db.from('UserProjectFolder')
        .update({ sortOrder: f.sortOrder, updatedAt: now })
        .eq('id', f.id)
        .eq('userId', meId)
    ))
    const err = results.find(r => r.error)?.error
    if (err) { console.error('bulkReorderHomeGrid folders failed:', err); throw err }
  }
  if (projects.length > 0) {
    const results = await Promise.all(projects.map(p =>
      db.from('UserProjectPlacement').upsert({
        userId: meId,
        projectId: p.id,
        folderId: null,
        sortOrder: p.sortOrder,
        createdAt: now,
        updatedAt: now,
      }, { onConflict: 'userId,projectId' })
    ))
    const err = results.find(r => r.error)?.error
    if (err) { console.error('bulkReorderHomeGrid placements failed:', err); throw err }
  }
}
