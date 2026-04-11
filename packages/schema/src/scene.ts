import { z } from "zod";

export const Scene = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  sceneNumber: z.string().min(1),
  title: z.string().nullable(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Scene = z.infer<typeof Scene>;
