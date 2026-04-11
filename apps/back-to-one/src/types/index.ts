// ══════════════════════════════════════════════════════════
// ORIGIN ONE — TYPE DEFINITIONS
// Source of truth. Matches planning handoff exactly.
// Maps 1:1 to Supabase schema.
// ══════════════════════════════════════════════════════════

// ── ENUMS ──────────────────────────────────────────────────

export type Phase = 'pre' | 'prod' | 'post'

export type ProjectType =
  | 'Commercial'
  | 'Narrative Short'
  | 'Feature'
  | 'Branded Documentary'
  | 'Documentary'
  | 'Music Video'
  | 'Other'

export type ProjectStatus =
  | 'In Development'
  | 'In Pre-Production'
  | 'In Production'
  | 'Shotlist in Progress'
  | 'Picture Lock in Progress'
  | 'In Post-Production'
  | 'Delivered'
  | 'Archived'

export type SceneMakerMode = 'script' | 'shotlist' | 'storyboard'

export type ShotOrderMode = 'story' | 'shooting'

export type LocationStatus = 'Scouted' | 'Option' | 'Selected' | 'Confirmed'

export type CastStatus = 'Uncast' | 'Hold' | 'Confirmed'

export type ArtStatus = 'In Progress' | 'Ready' | 'Approved' | 'Needs Review'

export type ArtCategory = 'props' | 'hmu' | 'wardrobe'

export type ResourceType = 'link' | 'deck' | 'doc' | 'folder' | 'contract' | 'video' | 'audio'

export type ResourceCategory = 'brief' | 'legal' | 'assets' | 'refs' | 'deliverables' | 'audio'

export type WorkflowNodeType =
  | 'storage' | 'software' | 'system'
  | 'transfer' | 'phase' | 'deliverable'

export type WorkflowPhase = 'onset' | 'post' | 'delivery'

export type ThreadContextType =
  | 'shot' | 'milestone' | 'task' | 'location'
  | 'role' | 'art' | 'workflow' | 'general'
  | 'sequence' // for docs like Freehand

// ── FOLDER ────────────────────────────────────────────────

export interface Folder {
  id: string
  name: string
  color: string
  logoUrl: string | null
  order: number
  createdAt: string
  updatedAt: string
}

// ── USER ───────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  department: string
  avatarColor1: string
  avatarColor2: string
  createdAt: string
}

// ── PROJECT ────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  type: ProjectType
  client: string
  company: string           // e.g. "Origin Point"
  phase: Phase
  status: ProjectStatus
  logline: string
  // Spec fields
  runtimeTarget: string | null    // e.g. "3:00"
  aspectRatio: string | null      // e.g. "2.39:1"
  captureFormat: string | null    // e.g. "Digital Cinema"
  startDate: string | null
  shootDate: string | null        // single shoot day
  shootDateEnd: string | null     // multi-day shoot end
  deliveryDate: string | null
  // Folder + ordering
  folderId: string | null
  displayOrder: number
  // Counters (derived but stored for perf)
  sceneCount: number
  shotCount: number
  // Timestamps
  createdAt: string
  updatedAt: string
}

// ── PROJECT MEMBER ─────────────────────────────────────────

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: string              // their role on this project
  department: string
  isOwner: boolean
  createdAt: string
}

// ── CREW MEMBER ────────────────────────────────────────────

export interface CrewMember {
  id: string
  projectId: string
  first: string
  last: string
  role: string
  dept: string
  color1: string
  color2: string
  online: boolean
  phone: string
  email: string
  allergies: string
  dealMemoUrl: string
  notes: string
  avatarUrl: string
  displayOrder: number
  createdAt: string
}

// ── ACTION ITEM ────────────────────────────────────────────

export interface ActionItem {
  id: string
  projectId: string
  name: string
  dept: string
  assigneeId: string | null   // crew member id
  dueDate: string | null      // ISO date YYYY-MM-DD
  notes: string
  done: boolean
  createdAt: string
  updatedAt: string
}

// ── MILESTONE ──────────────────────────────────────────────

export interface Milestone {
  id: string
  projectId: string
  name: string
  phase: Phase
  dept: string
  date: string              // ISO date
  notes: string
  people: string[]          // crew member ids
  isNext?: boolean          // computed
  createdAt: string
}

// ── COMMENT ────────────────────────────────────────────────

export interface Comment {
  id: string
  projectId: string
  contextType: string       // 'shot' | 'task' | 'scene' etc
  contextId: string         // id of the item being commented on
  authorId: string          // crew member id
  text: string
  createdAt: string
}

// ── THREAD ─────────────────────────────────────────────────

export interface Thread {
  id: string
  projectId: string
  contextType: ThreadContextType
  contextLabel: string      // e.g. "Shot 2B" or "Picture Lock Notes"
  contextRef: string        // item id
  subject: string
  unread: boolean           // computed client-side
  messages: ThreadMessage[]
  createdAt: string
  updatedAt: string
}

export interface ThreadMessage {
  id: string
  threadId: string
  authorId: string | null
  tagged: string[]          // crew member ids
  text: string
  createdAt: string
}

// ── SCENEMAKER ─────────────────────────────────────────────

export interface SceneMakerVersion {
  id: string
  projectId: string
  label: string             // 'v1', 'v2' etc
  isCurrent: boolean
  createdAt: string
}

export interface Scene {
  id: string
  projectId: string
  versionId: string
  num: number
  heading: string           // 'EXT. RAVINE EDGE – DUSK'
  // Script content (ordered blocks)
  action: string[]
  dialogue: DialogueLine[]
  action2: string[]
  dialogue2: DialogueLine[]
  action3: string[]
  dialogue3: DialogueLine[]
  action4: string[]
  createdAt: string
}

export interface DialogueLine {
  char: string
  line: string
}

export interface Shot {
  id: string                // e.g. '1A', '2B', 'FH-1A'
  projectId: string
  versionId: string
  sceneId: string
  storyOrder: number
  shootOrder: number
  desc: string              // shot description
  framing: string           // 'Wide Master', 'Medium', etc
  movement: string
  lens: string
  dirNotes: string
  prodNotes: string
  elements: string[]
  images: string[]          // storage URLs
  status: 'planned' | 'captured' | 'approved'
  createdAt: string
  updatedAt: string
}

// ── STORYBOARD CARD ────────────────────────────────────────
// Storyboard is a view over shots, not a separate data type.
// Each card = one Shot. This interface is for UI rendering only.

export interface StoryboardCard {
  shotId: string
  shotLabel: string         // e.g. '1A'
  sceneHeading: string
  desc: string
  framing: string
  imageUrl: string | null
  storyOrder: number
  shootOrder: number
}

// ── MOODBOARD ──────────────────────────────────────────────

export interface MoodboardRef {
  id: string
  projectId: string
  cat: 'tone' | 'visual' | 'product' | 'music'
  title: string
  note: string
  imageUrl: string | null
  gradient: string
  createdAt: string
}

// ── LOCATIONS ──────────────────────────────────────────────

export interface LocationGroup {
  id: string
  projectId: string
  scriptLocation: string
  type: 'VFX / Stage Build' | 'Practical' | 'Mixed'
  options: LocationOption[]
}

export interface LocationOption {
  id: string
  locationGroupId: string
  name: string
  status: LocationStatus
  gradient: string
  note: string
  createdAt: string
}

// ── CASTING ────────────────────────────────────────────────

export interface CastRole {
  id: string
  projectId: string
  name: string
  desc: string
  status: CastStatus
  scenes: string[]
  talent: CastTalent | null
  createdAt: string
  updatedAt: string
}

export interface CastTalent {
  name: string
  initials: string
  note: string
}

// ── ART ────────────────────────────────────────────────────

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

// ── RESOURCES ──────────────────────────────────────────────

export interface Resource {
  id: string
  projectId: string
  cat: ResourceCategory
  type: ResourceType
  title: string
  meta: string
  url: string
  pinned: boolean
  createdAt: string
}

// ── WORKFLOW ───────────────────────────────────────────────

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
