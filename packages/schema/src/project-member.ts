import { z } from "zod";
import { RoleEnum } from "./role";

export const ProjectMember = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: RoleEnum,
  // Budget arc — pre-filled line for crew timecard → expense conversion (Q2 hybrid).
  defaultLineItemId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
});

export type ProjectMember = z.infer<typeof ProjectMember>;
