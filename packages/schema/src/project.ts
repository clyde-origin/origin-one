import { z } from "zod";

export const ProjectStatus = z.enum([
  "development",
  "pre_production",
  "production",
  "post_production",
  "archived",
]);

export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const Project = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string().min(1),
  status: ProjectStatus,
  color: z.string().nullable(),
  client: z.string().nullable(),
  type: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Project = z.infer<typeof Project>;
