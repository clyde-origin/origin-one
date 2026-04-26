import { z } from "zod";

export const ShootDayType = z.enum(["pre", "prod", "post"]);

export type ShootDayType = z.infer<typeof ShootDayType>;

export const ShootDay = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  date: z.coerce.date(),
  type: ShootDayType,
  notes: z.string().nullable(),
  locationId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ShootDay = z.infer<typeof ShootDay>;
