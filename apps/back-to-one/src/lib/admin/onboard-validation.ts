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

export function isAdminEmail(email: string | null | undefined, allowlistEnv: string | undefined): boolean {
  if (!email) return false
  if (!allowlistEnv) return false
  const target = email.trim().toLowerCase()
  if (!target) return false
  const allowed = allowlistEnv
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(target)
}
