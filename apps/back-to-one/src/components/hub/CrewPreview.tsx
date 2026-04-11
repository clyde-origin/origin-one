import { CrewAvatar } from '@/components/ui'
import type { CrewMember } from '@/types'

interface CrewPreviewProps {
  crew: CrewMember[]
}

export function CrewPreview({ crew }: CrewPreviewProps) {
  const visible = crew.slice(0, 6)
  const extra = crew.length - visible.length

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      {visible.map(member => (
        <div key={member.id} className="flex flex-col items-center gap-1 flex-shrink-0">
          <CrewAvatar
            first={member.first}
            last={member.last}
            color1={member.color1}
            color2={member.color2}
            size={38}
            online={member.online}
          />
          <span className="font-sans text-[0.58rem] text-text2 w-10 text-center truncate">
            {member.first}
          </span>
          <span className="font-mono text-[0.44rem] text-muted truncate w-10 text-center">
            {member.role.split(' ')[0]}
          </span>
        </div>
      ))}

      {extra > 0 && (
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="w-[38px] h-[38px] rounded-full bg-surface2 border border-border flex items-center justify-center">
            <span className="font-mono text-[0.55rem] text-muted">+{extra}</span>
          </div>
          <span className="font-sans text-[0.58rem] text-muted">More</span>
        </div>
      )}
    </div>
  )
}
