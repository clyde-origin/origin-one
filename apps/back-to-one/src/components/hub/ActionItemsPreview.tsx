import type { ActionItem } from '@/types'

interface ActionItemsPreviewProps {
  items: ActionItem[]
}

export function ActionItemsPreview({ items }: ActionItemsPreviewProps) {
  const open = items.filter(i => !i.done)

  // Count by phase (derived from dept)
  const deptPhase: Record<string, string> = {
    Production: 'prod', Direction: 'prod', Camera: 'prod', 'G&E': 'prod',
    Casting: 'pre', Art: 'pre', Wardrobe: 'pre', HMU: 'pre',
    Sound: 'post', Post: 'post',
    Client: 'prod', Other: 'prod',
  }

  const counts = { pre: 0, prod: 0, post: 0 }
  open.forEach(item => {
    const phase = deptPhase[item.dept] ?? 'prod'
    counts[phase as keyof typeof counts]++
  })

  const total = open.length
  const maxCount = Math.max(...Object.values(counts), 1)

  const phases = [
    { key: 'pre',  label: 'Pre',  color: 'bg-pre',  textColor: 'text-pre',  count: counts.pre  },
    { key: 'prod', label: 'Prod', color: 'bg-prod', textColor: 'text-prod', count: counts.prod },
    { key: 'post', label: 'Post', color: 'bg-post', textColor: 'text-post', count: counts.post },
  ]

  return (
    <div className="flex flex-col gap-2">
      {/* Phase bars */}
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
      </div>
    </div>
  )
}
