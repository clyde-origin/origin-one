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

export type LocationStatus = 'unscouted' | 'scouting' | 'in_talks' | 'confirmed' | 'passed'

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
  | 'location'
  | 'character'
  | 'cast'
  | 'crew'
  | 'prop'
  | 'wardrobe'
  | 'hmu'
  | 'moodboardRef'
  | 'actionItem'
  | 'milestone'
  | 'deliverable'
  | 'workflowStage'
  | 'inventoryItem'

export interface Thread {
  id: string
  projectId: string
  attachedToType: ThreadAttachmentType
  attachedToId: string
  createdBy: string
  messages: ThreadMessage[]
  unreadCount: number
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

// ── INVENTORY ──────────────────────────────────────────────

export type InventoryItemStatus =
  | 'needed'
  | 'ordered'
  | 'arrived'
  | 'packed'
  | 'returned'

export type ImportSource = 'manual' | 'pdf' | 'excel'

// Flat shape, no joined assignee — matches the Location / CrewTimecard /
// ActionItem precedent. The Inventory page resolves assigneeId → User name
// client-side via useCrew(projectId), same pattern HubContent uses for
// ActionItem.assignedTo.
export interface InventoryItem {
  id: string
  projectId: string
  name: string
  quantity: number
  description: string | null
  department: string | null
  status: InventoryItemStatus
  source: string | null
  notes: string | null
  importSource: ImportSource
  assigneeId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ── TIMECARD RATE UNIT ─────────────────────────────────────

// Unit of time for a CrewTimecard rate. Schema column added 2026-04-26
// (#feat/rate-unit-schema). Existing rows backfilled to 'day' (all seed
// timecards are day rates ≥ $250). New timecards default to 'hour'.
// Math fix that consumes this enum lands in PR 6 of the budget arc;
// for now the column is populated but EntryCard / ProducerOverview
// math is unchanged (still produces the PR #19 known issue on hypothetical
// hour-unit rows — none exist in seed yet).
export type RateUnit = 'day' | 'hour'

// ── SHOOT DAY ──────────────────────────────────────────────

export type ShootDayType = 'pre' | 'prod' | 'post'

export interface ShootDay {
  id: string
  projectId: string
  date: string                  // ISO 'YYYY-MM-DD' from Postgres @db.Date
  type: ShootDayType
  notes: string | null
  locationId: string | null
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

// ── BUDGET ─────────────────────────────────────────────────
//
// Mirrors the Zod schemas in @origin-one/schema/src/{budget,expense}.ts.
// back-to-one consumes types locally rather than importing from
// @origin-one/schema (existing convention; see PR 2 / Schedule). Decimal
// columns are strings (Prisma serialization); convert with Number(...) at
// the math site.

export type BudgetVersionKind    = 'estimate' | 'working' | 'committed' | 'other'
export type BudgetVersionState   = 'draft' | 'locked'
export type BudgetAccountSection = 'ATL' | 'BTL'
export type BudgetUnit           = 'DAY' | 'WEEK' | 'HOUR' | 'FLAT' | 'UNIT'
export type MarkupTarget         = 'grandTotal' | 'accountSubtotal'
export type ExpenseSource        = 'timecard' | 'manual'

export interface Budget {
  id: string
  projectId: string
  currency: string
  rateSourceVersionId: string | null
  varianceThreshold: string                  // Decimal(5,4)
  clonedFromProjectId: string | null
  createdAt: string
  updatedAt: string
}

export interface BudgetVersion {
  id: string
  budgetId: string
  name: string
  kind: BudgetVersionKind
  sortOrder: number
  state: BudgetVersionState
  lockedAt: string | null
  lockedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface BudgetAccount {
  id: string
  budgetId: string
  parentId: string | null
  section: BudgetAccountSection
  code: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface BudgetLine {
  id: string
  budgetId: string
  accountId: string
  description: string
  unit: BudgetUnit
  fringeRate: string                          // Decimal(5,4)
  tags: string[]
  actualsRate: string | null                  // Decimal(12,2)
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface BudgetLineAmount {
  id: string
  lineId: string
  versionId: string
  qty: string                                 // formula or numeric literal
  rate: string                                // Decimal(12,2)
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface BudgetVariable {
  id: string
  budgetId: string
  versionId: string | null                    // null = budget-level
  name: string
  value: string                               // formula or numeric literal
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface BudgetMarkup {
  id: string
  budgetId: string
  versionId: string | null                    // null = applies to all versions
  name: string
  percent: string                             // Decimal(5,4)
  appliesTo: MarkupTarget
  accountId: string | null                    // required when appliesTo = accountSubtotal
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: string
  budgetId: string
  lineId: string
  source: ExpenseSource
  amount: string                              // Decimal(12,2)
  date: string                                // ISO 'YYYY-MM-DD'
  units: string | null                        // Decimal(8,2)
  unitRate: string | null                     // Decimal(12,2)
  unit: BudgetUnit | null
  vendor: string | null
  notes: string | null
  receiptUrl: string | null
  timecardId: string | null                   // @unique — one expense per timecard
  createdBy: string
  createdAt: string
  updatedAt: string
}
