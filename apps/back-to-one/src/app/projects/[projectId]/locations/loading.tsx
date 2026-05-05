// Locations route — Suspense fallback. Mirrors the loaded Locations panel
// layout exactly (apps/back-to-one/src/app/projects/[projectId]/locations/page.tsx):
//   PageHeader (Locations title + project meta)
//   counts row (booked · scripted + Scripted ▾ trigger)
//   tabs row (All + per-scene tabs)
//   .loc-grid (2-col grid of .loc-card panels with 16:9 hero + meta)
//
// Re-uses the page's own chrome (.loc-grid + .loc-card structural classes)
// so the skeleton inherits the loaded layout's borders, edge-glow, and
// 16:9 hero ratio — only inner content swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { LocationsSkeleton } from '@/components/locations/LocationsSkeleton'

export default function LocationsLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Locations"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
      />

      {/* Counts row — "booked · scripted" line + Scripted ▾ trigger */}
      <div
        style={{
          padding: '6px 20px 2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="sk sk-line" style={{ width: 130, height: 8 }} />
        <div className="sk sk-pill" style={{ width: 78, height: 20 }} />
      </div>

      {/* Tabs row — All + a few scene tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {[40, 80, 96, 72, 64].map((w, i) => (
          <div
            key={i}
            className="sk sk-pill flex-shrink-0"
            style={{ width: w, height: 22 }}
          />
        ))}
      </div>

      {/* Body — same scroll container the page uses */}
      <div
        className="flex-1 overflow-hidden"
        style={{ padding: '12px 16px 24px' }}
      >
        <LocationsSkeleton />
      </div>
    </div>
  )
}
