// SceneMaker route — Suspense fallback. Mirrors the loaded Scenemaker
// shell layout exactly (apps/back-to-one/src/app/projects/[projectId]/
// scenemaker/page.tsx):
//   .hub-topbar wraps both the PageHeader (One Arc kicker + project
//     switcher + status pill, export icon on the right) and the 3-up
//     mode tab strip (Script / Shotlist / Storyboard) as one frosted
//     block in the loaded UI
//   44px mode subheader bar (page swaps content per mode — Script
//     filter pills / Shotlist toolbar / Storyboard view-mode chips;
//     skeleton shows neutral pill row that reads as any of them)
//   <ScenemakerSkeleton /> — scene-divided list of .glass-tile.sk-tile
//     shot rows
//
// Re-uses the page's own chrome (.hub-topbar / .glass-tile.sk-tile) so
// the skeleton inherits the loaded layout's borders and gradients —
// only inner content swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { ScenemakerSkeleton } from '@/components/scenemaker/ScenemakerSkeleton'

export default function SceneMakerLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* .hub-topbar wraps PageHeader + mode tabs in the loaded UI —
          keep the same wrapper so the skeleton's frosted backdrop and
          bottom edge match what paints in. */}
      <div className="hub-topbar flex-shrink-0">
        <PageHeader
          projectId=""
          title=""
          meta={
            <div className="flex flex-col items-center" style={{ gap: 6 }}>
              {/* "One Arc" kicker */}
              <div className="sk sk-line" style={{ width: 50, height: 9 }} />
              {/* Project name */}
              <div className="sk sk-line" style={{ width: 130, height: 13 }} />
              {/* Status pill */}
              <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
            </div>
          }
          right={<div className="sk sk-circle" style={{ width: 36, height: 36 }} />}
          noBorder
        />

        {/* Mode tabs — Script / Shotlist / Storyboard.
            Mirrors page.tsx's flex row (3 equal-width buttons, 11px vertical
            padding). Center pill is "active" (sk-line lifted to 9px height
            + accent underline below). */}
        <div className="flex">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="flex-1 text-center relative"
              style={{ padding: '11px 0', display: 'flex', justifyContent: 'center' }}
            >
              <div
                className="sk sk-line"
                style={{ width: 56, height: i === 1 ? 9 : 8 }}
              />
              {i === 1 && (
                <div
                  className="sk"
                  style={{
                    position: 'absolute', bottom: 0, left: '20%', right: '20%',
                    height: 1, borderRadius: '1px 1px 0 0',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 44px subheader — neutral centered pill row that reads as any of
          the three mode subheaders (Script filter pills / Shotlist
          toolbar / Storyboard view-mode chips). */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          height: 44, padding: '0 14px', gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="sk sk-pill" style={{ width: 70, height: 22 }} />
        <div className="sk sk-pill" style={{ width: 84, height: 22 }} />
        <div className="sk sk-pill" style={{ width: 56, height: 22 }} />
      </div>

      {/* Content body */}
      <div
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: 100 }}
      >
        <ScenemakerSkeleton />
      </div>
    </div>
  )
}
