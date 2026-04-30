export interface DeltaInput {
  newMentions: string[]
  alreadyNotified: string[]
  actorId: string
}

export function computeMentionDelta(input: DeltaInput): string[] {
  const skip = new Set([...input.alreadyNotified, input.actorId])
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of input.newMentions) {
    if (skip.has(id)) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
