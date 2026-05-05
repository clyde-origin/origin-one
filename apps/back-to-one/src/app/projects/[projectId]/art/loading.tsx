// Art route — Suspense fallback. Mirrors the loaded Art panel layout
// exactly (apps/back-to-one/src/app/projects/[projectId]/art/page.tsx):
//   PageHeader (Art title + project meta / status pill)
//   .hub-toggle 3-tab strip (Wardrobe / Set Dec & Props / HMU)
//   scroll wrapper hosting <ArtSkeleton /> (section header + 2-col
//   .art-grid of 6 .art-card stubs with 1:1 hero + name + meta)
//
// Re-uses the page's own chrome classes (.hub-toggle / .art-section /
// .art-section-header / .art-grid / .art-card) so the skeleton inherits
// the loaded layout's borders and spacing — only inner content swaps for
// .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { ArtSkeleton } from '@/components/art/ArtSkeleton'

export default function ArtLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Art"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
        noBorder
      />

      {/* Tab strip — matches page.tsx's .hub-toggle 3-up segmented row.
          Inner labels swap for centered .sk-line rectangles. */}
      <div style={{ padding: '8px 16px 4px' }}>
        <div className="hub-toggle" role="tablist" aria-label="Art type">
          {[44, 60, 30].map((w, i) => (
            <div
              key={i}
              className="hub-toggle-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div className="sk sk-line" style={{ width: w, height: 8 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Scroll body — matches page.tsx scroll area padding */}
      <div
        className="flex-1 overflow-hidden"
        style={{ padding: '14px 16px 100px' }}
      >
        <ArtSkeleton />
      </div>
    </div>
  )
}
