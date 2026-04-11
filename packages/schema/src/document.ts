import { z } from "zod";

export const DocumentType = z.enum([
  "script",
  "scene",
  "board",
  "lore",
  "note",
]);

export type DocumentType = z.infer<typeof DocumentType>;

export const Document = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  type: DocumentType,
  title: z.string().min(1),
  content: z.string(),
  version: z.number().int().min(1),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Document = z.infer<typeof Document>;
