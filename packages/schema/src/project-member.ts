import { z } from "zod";
import { RoleEnum } from "./role";

export const ProjectMember = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: RoleEnum,
  createdAt: z.coerce.date(),
});

export type ProjectMember = z.infer<typeof ProjectMember>;
