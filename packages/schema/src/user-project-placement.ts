import { z } from "zod";

export const UserProjectPlacement = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserProjectPlacement = z.infer<typeof UserProjectPlacement>;
