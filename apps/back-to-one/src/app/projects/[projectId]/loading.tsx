// Hub route — Suspense fallback. Streams while the per-project Hub JS
// chunk loads (or recompiles in dev). Renders the same HubSkeleton that
// HubContent uses while React Query is fetching, so the route-transition
// fallback and the data-loading fallback look identical end-to-end.
import { HubSkeleton } from '@/components/hub/HubSkeleton'

export default function HubLoading() {
  return <HubSkeleton />
}
