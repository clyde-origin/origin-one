import { z } from "zod";

export const EntityType = z.enum(["character", "location", "prop"]);

export type EntityType = z.infer<typeof EntityType>;

export const Entity = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  type: EntityType,
  name: z.string().min(1),
  description: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Entity = z.infer<typeof Entity>;
