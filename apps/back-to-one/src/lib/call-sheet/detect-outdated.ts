// Pure delta detection: compares a delivery's stored snapshot against the
// current "fresh" snapshot for that recipient and decides whether the row
// should be flagged outdated (key fields changed) or left alone.

import type { RecipientSnapshot } from './personalize'

export function snapshotsDiffer(a: RecipientSnapshot | null, b: RecipientSnapshot): boolean {
  if (!a) return false  // no prior snapshot → cannot compute delta
  if (a.callTime !== b.callTime) return true
  if (a.locationAddress !== b.locationAddress) return true
  if (a.shootDate !== b.shootDate) return true
  if (a.lunchTime !== b.lunchTime) return true
  if (a.scheduleBlockIds.length !== b.scheduleBlockIds.length) return true
  const sortedA = [...a.scheduleBlockIds].sort()
  const sortedB = [...b.scheduleBlockIds].sort()
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return true
  }
  return false
}

export function findOutdatedDeliveryIds(input: {
  deliveries: { id: string; recipientId: string; personalizedSnapshot: RecipientSnapshot | null }[]
  freshSnapshotsByRecipient: Record<string, RecipientSnapshot>
}): string[] {
  return input.deliveries
    .filter(d => {
      const fresh = input.freshSnapshotsByRecipient[d.recipientId]
      if (!fresh) return false
      return snapshotsDiffer(d.personalizedSnapshot, fresh)
    })
    .map(d => d.id)
}
