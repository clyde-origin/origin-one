import { z } from "zod";

export const MilestoneStatus = z.enum([
  "upcoming",
  "in_progress",
  "completed",
]);

export type MilestoneStatus = z.infer<typeof MilestoneStatus>;

export const Milestone = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  date: z.coerce.date(),
  status: MilestoneStatus,
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type Milestone = z.infer<typeof Milestone>;

export const MilestonePerson = z.object({
  id: z.string().uuid(),
  milestoneId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type MilestonePerson = z.infer<typeof MilestonePerson>;
