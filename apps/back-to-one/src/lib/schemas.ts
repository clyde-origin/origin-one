import { z } from 'zod'

// ── ENUMS ──────────────────────────────────────────────────

export const PhaseSchema = z.enum(['pre', 'prod', 'post'])

export const ArtCategorySchema = z.enum(['props', 'hmu', 'wardrobe'])

export const ArtStatusSchema = z.enum([
  'In Progress', 'Ready', 'Approved', 'Needs Review'
])

export const CastStatusSchema = z.enum(['Uncast', 'Hold', 'Confirmed'])

export const LocationStatusSchema = z.enum([
  'Scouted', 'Option', 'Selected', 'Confirmed'
])

export const WorkflowNodeTypeSchema = z.enum([
  'storage', 'software', 'system', 'transfer', 'phase', 'deliverable'
])

export const WorkflowPhaseSchema = z.enum(['onset', 'post', 'delivery'])

export const ResourceTypeSchema = z.enum([
  'link', 'deck', 'doc', 'folder', 'contract'
])

export const ResourceCategorySchema = z.enum([
  'brief', 'legal', 'assets', 'refs', 'deliverables'
])

export const ShotOrderModeSchema = z.enum(['story', 'shooting'])

export const SceneMakerModeSchema = z.enum([
  'script', 'shotlist', 'storyboard'
])

// ── CORE ───────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id:         z.string().uuid(),
  name:       z.string().min(1),
  client:     z.string(),
  phase:      PhaseSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

export const CrewMemberSchema = z.object({
  id:         z.string().uuid(),
  project_id: z.string().uuid(),
  first:      z.string().min(1),
  last:       z.string().min(1),
  role:       z.string().min(1),
  dept:       z.string().min(1),
  color1:     z.string(),
  color2:     z.string(),
  online:     z.boolean(),
  created_at: z.string(),
})

// ── ACTION ITEMS ───────────────────────────────────────────

export const ActionItemSchema = z.object({
  id:          z.string().uuid(),
  project_id:  z.string().uuid(),
  name:        z.string().min(1, 'Task name is required'),
  dept:        z.string().min(1),
  assignee_id: z.string().uuid().nullable(),
  due_date:    z.string().nullable(),
  notes:       z.string(),
  done:        z.boolean(),
  created_at:  z.string(),
  updated_at:  z.string(),
})

export const CreateActionItemSchema = ActionItemSchema.omit({
  id: true, created_at: true, updated_at: true, done: true,
}).extend({ done: z.boolean().default(false) })

// ── MILESTONES ─────────────────────────────────────────────

export const MilestoneSchema = z.object({
  id:         z.string().uuid(),
  project_id: z.string().uuid(),
  name:       z.string().min(1, 'Milestone name is required'),
  phase:      PhaseSchema,
  dept:       z.string(),
  date:       z.string(),
  notes:      z.string(),
  people:     z.array(z.string().uuid()),
  created_at: z.string(),
})

export const CreateMilestoneSchema = MilestoneSchema.omit({
  id: true, created_at: true,
})

// ── SCENEMAKER ─────────────────────────────────────────────

export const DialogueLineSchema = z.object({
  char: z.string(),
  line: z.string(),
})

export const SMVersionSchema = z.object({
  id:         z.string().uuid(),
  project_id: z.string().uuid(),
  label:      z.string(),
  is_current: z.boolean(),
  created_at: z.string(),
})

export const SMSceneSchema = z.object({
  id:         z.string().uuid(),
  project_id: z.string().uuid(),
  version_id: z.string().uuid(),
  num:        z.number(),
  heading:    z.string(),
  action:     z.array(z.string()),
  dialogue:   z.array(DialogueLineSchema),
  action2:    z.array(z.string()),
  dialogue2:  z.array(DialogueLineSchema),
  action3:    z.array(z.string()),
  dialogue3:  z.array(DialogueLineSchema),
  action4:    z.array(z.string()),
})

export const SMShotSchema = z.object({
  id:          z.string().uuid(),
  project_id:  z.string().uuid(),
  version_id:  z.string().uuid(),
  scene_id:    z.string().uuid(),
  story_order: z.number(),
  shoot_order: z.number(),
  desc:        z.string(),
  framing:     z.string(),
  movement:    z.string(),
  lens:        z.string(),
  dir_notes:   z.string(),
  prod_notes:  z.string(),
  elements:    z.array(z.string()),
  images:      z.array(z.string()),
  created_at:  z.string(),
  updated_at:  z.string(),
})

// ── FORMS (used with React Hook Form) ─────────────────────

export const NewActionItemFormSchema = z.object({
  name:        z.string().min(1, 'Task name is required'),
  dept:        z.string().min(1, 'Department is required'),
  assignee_id: z.string().nullable(),
  due_date:    z.string().nullable(),
  notes:       z.string().optional(),
})

export const NewMilestoneFormSchema = z.object({
  name:   z.string().min(1, 'Milestone name is required'),
  phase:  PhaseSchema,
  dept:   z.string().min(1),
  date:   z.string().min(1, 'Date is required'),
  notes:  z.string().optional(),
  people: z.array(z.string()).default([]),
})

export const NewCrewMemberFormSchema = z.object({
  first: z.string().min(1, 'First name is required'),
  last:  z.string().min(1, 'Last name is required'),
  role:  z.string().min(1, 'Role is required'),
  dept:  z.string().min(1, 'Department is required'),
})

export const PostCommentFormSchema = z.object({
  text:   z.string().min(1),
  tagged: z.array(z.string()).default([]),
})

// ── INFERRED TYPES ─────────────────────────────────────────

export type Project            = z.infer<typeof ProjectSchema>
export type CrewMember         = z.infer<typeof CrewMemberSchema>
export type ActionItem         = z.infer<typeof ActionItemSchema>
export type CreateActionItem   = z.infer<typeof CreateActionItemSchema>
export type Milestone          = z.infer<typeof MilestoneSchema>
export type SMVersion          = z.infer<typeof SMVersionSchema>
export type SMScene            = z.infer<typeof SMSceneSchema>
export type SMShot             = z.infer<typeof SMShotSchema>
export type NewActionItemForm  = z.infer<typeof NewActionItemFormSchema>
export type NewMilestoneForm   = z.infer<typeof NewMilestoneFormSchema>
export type NewCrewMemberForm  = z.infer<typeof NewCrewMemberFormSchema>
export type PostCommentForm    = z.infer<typeof PostCommentFormSchema>
