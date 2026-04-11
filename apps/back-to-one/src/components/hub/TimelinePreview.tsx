import { formatDate, isUrgent } from '@/lib/utils/phase'
import type { Milestone, Project } from '@/types'

interface TimelinePreviewProps {
  milestones: Milestone[]
  project: Project
}

export function TimelinePreview({ milestones, project }: TimelinePreviewProps) {
  const upcoming = milestones
    .filter(m => new Date(m.date) >= new Date())
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-2.5">
      {/* Phase bar */}
      <div className="flex rounded-sm overflow-hidden h-5 gap-px">
        {(['pre', 'prod', 'post'] as const).map(phase => (
          <div
            key={phase}
            className={`flex-1 flex items-center justify-center font-mono text-[0.44rem] tracking-widest uppercase font-medium
              ${phase === 'pre'  ? 'bg-pre/20 text-pre' : ''}
              ${phase === 'prod' ? `text-prod ${project.phase === 'prod' ? 'bg-prod/30' : 'bg-prod/15'}` : ''}
              ${phase === 'post' ? 'bg-post/15 text-post' : ''}
            `}
          >
            {phase}
          </div>
        ))}
      </div>

      {/* Next milestones */}
      <div className="flex flex-col gap-1.5">
        {upcoming.length === 0 ? (
          <p className="font-mono text-[0.5rem] text-muted">No upcoming milestones</p>
        ) : (
          upcoming.map(ms => {
            const urgent = isUrgent(ms.date)
            return (
              <div key={ms.id} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  ms.phase === 'pre' ? 'bg-pre' :
                  ms.phase === 'prod' ? 'bg-prod' : 'bg-post'
                }`} />
                <span className="text-[0.72rem] text-text flex-1 truncate">{ms.name}</span>
                <span className={`font-mono text-[0.52rem] flex-shrink-0 ${
                  urgent ? 'text-pre' : 'text-muted'
                }`}>
                  {formatDate(ms.date)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
