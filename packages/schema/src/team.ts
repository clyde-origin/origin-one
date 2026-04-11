import { z } from "zod";
import { RoleEnum } from "./role";

export const Team = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Team = z.infer<typeof Team>;

export const TeamMember = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  role: RoleEnum,
  createdAt: z.coerce.date(),
});

export type TeamMember = z.infer<typeof TeamMember>;
