import { z } from "zod";

export const MoodCategory = z.enum(["tone", "visual", "product", "music"]);

export type MoodCategory = z.infer<typeof MoodCategory>;

export const MoodboardRef = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  cat: MoodCategory,
  title: z.string().min(1),
  note: z.string().nullable(),
  imageUrl: z.string().nullable(),
  gradient: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type MoodboardRef = z.infer<typeof MoodboardRef>;
