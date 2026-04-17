// ══════════════════════════════════════════════════════════
// ORIGIN ONE — TYPE DEFINITIONS
// Source of truth. Maps 1:1 to new Prisma schema.
// ══════════════════════════════════════════════════════════

// ── ENUMS ──────────────────────────────────────────────────

export type ProjectStatus =
  | 'development'
  | 'pre_production'
  | 'production'
  | 'post_production'
  | 'archived'

export type MilestoneStatus = 'upcoming' | 'in_progress' | 'completed'

export type ActionItemStatus = 'open' | 'in_progress' | 'done'

export type ResourceType = 'link' | 'file' | 'image' | 'video' | 'document'

export type Role = 'director' | 'producer' | 'coordinator' | 'writer' | 'crew'

export type SceneMakerMode = 'script' | 'shotlist' | 'storyboard'

export type ShotOrderMode = 'story' | 'shooting'

export type LocationStatus = 'booked' | 'in_talks' | 'scouting' | 'no_contact'

export type CastStatus = 'Uncast' | 'Hold' | 'Confirmed'

export type ArtStatus = 'In Progress' | 'Ready' | 'Approved' | 'Needs Review'

export type ArtCategory = 'props' | 'hmu' | 'wardrobe'

export type WorkflowNodeType =
  | 'storage' | 'software' | 'system'
  | 'transfer' | 'phase' | 'deliverable'

export type WorkflowPhase = 'onset' | 'post' | 'delivery'

// ── USER ───────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

// ── TEAM MEMBER (crew) ────────────────────────────���───────

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: Role
  createdAt: string
  User: User
}

// Keep CrewMember as alias for backwards compat in components
export type CrewMember = TeamMember

// ── PROJECT ────────────────────────────────────────────────

export interface Project {
  id: string
  teamId: string
  name: string
  status: ProjectStatus
  color: string | null
  client: string | null
  type: string | null
  aspectRatio: string | null
  createdAt: string
  updatedAt: string
}

// ── FOLDER ────────────────────────���───────────────────────

export interface Folder {
  id: string
  projectId: string
  name: string
  createdAt: string
}

// ── ACTION ITEM ────────────────────────────────────────────

export interface ActionItem {
  id: string
  projectId: string
  title: string
  description: string | null
  status: ActionItemStatus
  assignedTo: string | null
  department: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

// ── MILESTONE ──────────────────────────────────────────────

export interface Milestone {
  id: string
  projectId: string
  title: string
  date: string
  status: MilestoneStatus
  notes: string | null
  people: string[]
  createdAt: string
}

// ── THREAD ─────────────────────────────────────────────────

export type ThreadAttachmentType =
  | 'shot'
  | 'scene'
  | 'actionItem'
  | 'cast'
  | 'art'
  | 'deliverable'
  | 'location'
  | 'milestone'
  | 'crew'
  | 'chatMessage'

export interface Thread {
  id: string
  projectId: string
  attachedToType: ThreadAttachmentType
  attachedToId: string
  createdBy: string
  messages: ThreadMessage[]
  unread: boolean
  createdAt: string
  updatedAt: string
}

export interface ThreadMessage {
  id: string
  threadId: string
  content: string
  createdBy: string
  createdAt: string
}

// ── RESOURCE ────────────────────────────────��─────────────

export interface Resource {
  id: string
  projectId: string
  folderId: string | null
  title: string
  url: string
  type: ResourceType
  createdBy: string
  createdAt: string
}

// ── SCENE + SHOT (new Prisma schema) ─────────────────────

export interface Scene {
  id: string
  projectId: string
  sceneNumber: string
  title: string | null
  description: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Shot {
  id: string
  sceneId: string
  shotNumber: string
  size: string | null
  description: string | null
  notes: string | null
  imageUrl: string | null
  status: 'planned' | 'in_progress' | 'completed' | 'omitted'
  sortOrder: number
  shootOrder: number | null
  createdAt: string
  updatedAt: string
}

// ── STUB TYPES (not yet in new schema) ────────────────────

export interface SceneMakerVersion {
  id: string
  projectId: string
  label: string
  isCurrent: boolean
  createdAt: string
}

export interface DialogueLine {
  char: string
  line: string
}

export interface StoryboardCard {
  shotId: string
  shotLabel: string
  sceneHeading: string
  desc: string
  framing: string
  imageUrl: string | null
  storyOrder: number
  shootOrder: number
}

export interface MoodboardTab {
  id: string
  projectId: string
  name: string
  sortOrder: number
  createdAt: string
}

export interface MoodboardRef {
  id: string
  projectId: string
  cat: 'tone' | 'visual' | 'product' | 'music'
  title: string
  note: string
  imageUrl: string | null
  gradient: string
  sortOrder: number
  tabId: string | null
  createdAt: string
}

export interface Location {
  id: string
  projectId: string
  name: string
  description: string | null
  address: string | null
  keyContact: string | null
  webLink: string | null
  shootDates: string | null
  status: LocationStatus
  approved: boolean
  notes: string | null
  imageUrl: string | null
  sceneTab: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CastRole {
  id: string
  projectId: string
  role: string
  roleDesc: string
  section: string
  scenes: string[]
  roleNotes: string
  assignmentId: string | null
  cast: boolean
  talent: CastTalent | null
  createdAt: string
  updatedAt: string
}

export interface CastTalent {
  id: string
  name: string
  initials: string
  agency: string
  email: string
  phone: string
  repName: string
  repEmail: string
  repPhone: string
  dietary: string
  shootDates: string[]
  notes: string
}

export interface ArtItem {
  id: string
  projectId: string
  name: string
  cat: ArtCategory
  status: ArtStatus
  note: string
  gradient: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowNode {
  id: string
  projectId: string
  label: string
  type: WorkflowNodeType
  phase: WorkflowPhase
  note: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  projectId: string
  contextType: string
  contextId: string
  authorId: string
  text: string
  createdAt: string
}

// ── UI STATE (client only, never persisted) ────────────────

export interface UIState {
  currentProjectId: string | null
  navHistory: string[]
  openSheets: string[]
  scenemaker: {
    mode: SceneMakerMode
    orderMode: ShotOrderMode
    versionId: string | null
    expandedShotId: string | null
  }
}

// ── HELPERS ────────────────────────────────────────────────

export type PhaseColor = {
  text: string
  bg: string
  border: string
  dot: string
}
