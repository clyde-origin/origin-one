import { z } from "zod";

export const TeamProjectPlacement = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  projectId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TeamProjectPlacement = z.infer<typeof TeamProjectPlacement>;
