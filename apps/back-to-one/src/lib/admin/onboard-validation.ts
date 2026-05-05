import { z } from 'zod'

const trimmedString = (max: number) =>
  z.string().transform(s => s.trim()).pipe(z.string().min(1).max(max))

const trimmedEmail = z.string().transform(s => s.trim()).pipe(z.string().email().min(1).max(254))

export const producerSchema = z.object({
  name: trimmedString(80),
  email: trimmedEmail,
})

export const onboardRequestSchema = z.object({
  companyName: trimmedString(80),
  projectName: trimmedString(80),
  producers: z.array(producerSchema).min(1).max(20),
})

export type OnboardRequest = z.infer<typeof onboardRequestSchema>
export type Producer = z.infer<typeof producerSchema>
