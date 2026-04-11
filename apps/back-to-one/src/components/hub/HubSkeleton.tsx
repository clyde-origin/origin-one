import { SkeletonLine, SkeletonAvatar, SkeletonCard } from '@/components/ui'

export function HubSkeleton() {
  return (
    <div className="screen">
      {/* Topbar skeleton */}
      <div className="flex flex-col justify-end px-5 flex-shrink-0 border-b border-border" style={{ minHeight: 100, paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 12, background: 'rgba(4,4,10,0.92)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <SkeletonLine w={28} h={28} className="rounded-full" />
          <div className="flex gap-1.5">
            <SkeletonLine w={64} h={24} className="rounded-full" />
            <SkeletonLine w={64} h={24} className="rounded-full" />
          </div>
        </div>
        <SkeletonLine w={180} h={20} className="mb-1.5" />
        <div className="flex items-center gap-2">
          <SkeletonLine w={80} h={10} />
          <SkeletonLine w={100} h={10} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden" style={{ padding: '12px 16px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Crew row */}
        <div className="grid grid-cols-6 gap-1" style={{ padding: '4px 0' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <SkeletonAvatar size={36} />
              <SkeletonLine w={36} h={8} />
              <SkeletonLine w={28} h={6} />
            </div>
          ))}
        </div>

        {/* Action Items */}
        <div className="flex items-center gap-3.5" style={{ padding: '4px 0' }}>
          <div className="animate-pulse rounded-full flex-shrink-0" style={{ width: 108, height: 108, border: '4px solid rgba(255,255,255,0.04)' }} />
          <div className="flex-1 flex flex-col gap-1.5">
            <SkeletonLine w={72} h={8} />
            <SkeletonCard>
              <SkeletonLine w="90%" h={10} />
              <SkeletonLine w="70%" h={10} />
              <SkeletonLine w="80%" h={10} />
            </SkeletonCard>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ padding: '4px 0' }}>
          <div className="flex justify-between mb-1.5">
            <SkeletonLine w={40} h={8} />
            <SkeletonLine w={40} h={8} />
          </div>
          <SkeletonLine w="100%" h={26} className="rounded-md mb-3" />
          <SkeletonCard>
            <SkeletonLine w="85%" h={10} />
            <SkeletonLine w="70%" h={10} />
            <SkeletonLine w="60%" h={10} />
          </SkeletonCard>
        </div>

        {/* SceneMaker + Moodboard */}
        <div className="flex gap-2">
          <SkeletonCard>
            <div className="flex gap-1.5">
              <SkeletonLine w="100%" h={40} className="rounded-sm" />
              <SkeletonLine w="100%" h={40} className="rounded-sm" />
              <SkeletonLine w="100%" h={40} className="rounded-sm" />
            </div>
            <SkeletonLine w="60%" h={8} />
          </SkeletonCard>
          <div className="animate-pulse rounded-xl flex-shrink-0" style={{ width: 88, height: 100, background: 'rgba(255,255,255,0.04)' }} />
        </div>

        {/* Locations row */}
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i}>
              <SkeletonLine w={48} h={10} />
              <SkeletonLine w={28} h={8} />
              <SkeletonLine w="100%" h={3} />
            </SkeletonCard>
          ))}
        </div>

        {/* Workflow */}
        <div className="flex items-center justify-between" style={{ padding: '4px 4px 12px', marginTop: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center" style={{ flex: 1 }}>
              <div className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                <SkeletonLine w={36} h={36} className="rounded-lg" />
                <SkeletonLine w={32} h={6} />
              </div>
              {i < 4 && <SkeletonLine w={12} h={1} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
