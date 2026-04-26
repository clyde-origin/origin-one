import { z } from "zod";

export const ResourceType = z.enum([
  "link",
  "file",
  "image",
  "video",
  "document",
]);

export type ResourceType = z.infer<typeof ResourceType>;

export const Resource = z.object({
  id: z.string().uuid(),
  // null → company-scoped (cross-project) resource; uuid → per-project.
  projectId: z.string().uuid().nullable(),
  folderId: z.string().uuid().nullable(),
  title: z.string().min(1),
  url: z.string(),
  type: ResourceType,
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export type Resource = z.infer<typeof Resource>;
