/**
 * Fire-and-forget POST to /api/push/dispatch. Errors are logged but never
 * thrown — the in-app notification has already been delivered via realtime.
 */
export async function dispatchPush(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return
  try {
    await fetch('/api/push/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds }),
    })
  } catch (err) {
    console.warn('dispatchPush failed (non-fatal):', err)
  }
}
