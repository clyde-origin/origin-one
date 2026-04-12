import type { ActionItem } from '@/types'

interface ActionItemsPreviewProps {
  items: ActionItem[]
}

export function ActionItemsPreview({ items }: ActionItemsPreviewProps) {
  const open = items.filter(i => i.status !== 'done')

  const counts = { open: 0, in_progress: 0, done: 0 }
  open.forEach(item => {
    if (item.status === 'in_progress') counts.in_progress++
    else counts.open++
  })

  const total = open.length
  const maxCount = Math.max(counts.open, counts.in_progress, 1)

  const phases = [
    { key: 'open',        label: 'Open',    color: 'bg-pre',  textColor: 'text-pre',  count: counts.open        },
    { key: 'in_progress', label: 'Active',  color: 'bg-prod', textColor: 'text-prod', count: counts.in_progress },
  ]

  return (
    <div className="flex flex-col gap-2">
      {/* Bars */}
      <div className="flex gap-2 items-end h-10">
        {phases.map(p => (
          <div key={p.key} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-surface2 rounded-sm overflow-hidden h-8 flex items-end">
              <div
                className={`w-full rounded-sm transition-all duration-500 ${p.color}`}
                style={{ height: `${(p.count / maxCount) * 100}%`, minHeight: p.count > 0 ? 4 : 0 }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Counts */}
      <div className="flex gap-2">
        {phases.map(p => (
          <div key={p.key} className="flex-1 flex flex-col items-center gap-0.5">
            <span className={`font-bold text-base leading-none ${p.textColor}`}>
              {p.count}
            </span>
            <span className="font-mono text-[0.44rem] tracking-widest uppercase text-muted font-light">
              {p.label}
            </span>
          </div>
        ))}
        <div className="flex-1 flex flex-col items-center gap-0.5">
          <span className="font-bold text-base leading-none text-text2">
            {total}
          </span>
          <span className="font-mono text-[0.44rem] tracking-widest uppercase text-muted font-light">
            Total
          </span>
        </div>
      </div>
    </div>
  )
}
