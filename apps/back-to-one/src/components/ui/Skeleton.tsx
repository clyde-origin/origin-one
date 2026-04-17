export function SkeletonLine({
  w = '100%',
  h = 12,
  className = '',
}: {
  w?: string | number
  h?: number
  className?: string
}) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ width: w, height: h, background: 'rgba(255,255,255,0.06)' }}
    />
  )
}

export function SkeletonAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="animate-pulse rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: 'rgba(255,255,255,0.06)' }}
    />
  )
}

export function SkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 p-3 flex flex-col gap-2 bg-surface">
      {children}
    </div>
  )
}
