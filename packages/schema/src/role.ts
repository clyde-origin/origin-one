import { z } from "zod";

export const RoleEnum = z.enum([
  "director",
  "producer",
  "coordinator",
  "writer",
  "crew",
]);

export type RoleEnum = z.infer<typeof RoleEnum>;
