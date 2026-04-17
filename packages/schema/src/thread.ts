import { z } from "zod";

export const Thread = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  attachedToType: z.string(),
  attachedToId: z.string(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Thread = z.infer<typeof Thread>;

export const ThreadMessage = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  content: z.string().min(1),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export type ThreadMessage = z.infer<typeof ThreadMessage>;
