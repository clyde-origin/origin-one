import { z } from "zod";

export const UserProjectFolder = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserProjectFolder = z.infer<typeof UserProjectFolder>;
