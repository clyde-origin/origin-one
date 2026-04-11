import { z } from "zod";

export const ActionItemStatus = z.enum([
  "open",
  "in_progress",
  "done",
]);

export type ActionItemStatus = z.infer<typeof ActionItemStatus>;

export const ActionItem = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: ActionItemStatus,
  assignedTo: z.string().uuid().nullable(),
  dueDate: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ActionItem = z.infer<typeof ActionItem>;
