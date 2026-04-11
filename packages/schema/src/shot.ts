import { z } from "zod";

export const ShotStatus = z.enum([
  "planned",
  "in_progress",
  "completed",
  "omitted",
]);

export type ShotStatus = z.infer<typeof ShotStatus>;

export const ShotSize = z.enum([
  "extreme_wide",
  "wide",
  "full",
  "medium",
  "medium_close_up",
  "close_up",
  "extreme_close_up",
  "insert",
]);

export type ShotSize = z.infer<typeof ShotSize>;

export const Shot = z.object({
  id: z.string().uuid(),
  sceneId: z.string().uuid(),
  shotNumber: z.string().min(1),
  size: ShotSize.nullable(),
  description: z.string().nullable(),
  status: ShotStatus,
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Shot = z.infer<typeof Shot>;
