const SW_PATH = '/sw.js'
const SW_SCOPE = '/'

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false
  if (!('PushManager' in window)) return false
  if (!('Notification' in window)) return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  if (isIOS) {
    const standalone = (window.matchMedia?.('(display-mode: standalone)').matches)
      || (navigator as any).standalone === true
    if (!standalone) return false
  }
  return true
}

export function hasNotificationPermission(): boolean {
  if (typeof Notification === 'undefined') return false
  return Notification.permission === 'granted'
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('serviceWorker not supported')
  const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  if (existing) return existing
  return navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE })
}

export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('push not supported in this browser context')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('notification permission denied')

  const reg = await registerServiceWorker()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) throw new Error('VAPID public key missing in env')
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }
  await postSubscription(sub)
  return sub
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await sub.unsubscribe()
  await deleteSubscription(sub.endpoint)
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  return (await reg?.pushManager.getSubscription()) ?? null
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
    }),
  })
  if (!res.ok) throw new Error(`subscribe failed: ${res.status}`)
}

async function deleteSubscription(endpoint: string): Promise<void> {
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out.buffer
}
