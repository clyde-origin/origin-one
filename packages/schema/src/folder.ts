import { z } from "zod";

export const Folder = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.coerce.date(),
});

export type Folder = z.infer<typeof Folder>;
