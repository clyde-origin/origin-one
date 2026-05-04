import { z } from "zod";

export const TeamProjectFolder = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TeamProjectFolder = z.infer<typeof TeamProjectFolder>;
