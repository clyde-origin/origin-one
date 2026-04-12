import { formatDate, isUrgent, MILESTONE_STATUS_HEX } from '@/lib/utils/phase'
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
      {/* Status bar */}
      <div className="flex rounded-sm overflow-hidden h-5 gap-px">
        {(['development', 'pre_production', 'production', 'post_production'] as const).map(s => (
          <div
            key={s}
            className="flex-1 flex items-center justify-center font-mono text-[0.44rem] tracking-widest uppercase font-medium"
            style={{
              background: project.status === s
                ? `${MILESTONE_STATUS_HEX[s] ?? '#62627a'}30`
                : 'rgba(255,255,255,0.04)',
              color: project.status === s
                ? (MILESTONE_STATUS_HEX[s] ?? '#62627a')
                : '#62627a',
            }}
          >
            {s === 'development' ? 'dev' :
             s === 'pre_production' ? 'pre' :
             s === 'production' ? 'prod' : 'post'}
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
            const dotColor = MILESTONE_STATUS_HEX[ms.status] ?? '#62627a'
            return (
              <div key={ms.id} className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: dotColor }}
                />
                <span className="text-[0.72rem] text-text flex-1 truncate">{ms.title}</span>
                <span className={`font-mono text-[0.52rem] flex-shrink-0 ${urgent ? 'text-pre' : 'text-muted'}`}>
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
