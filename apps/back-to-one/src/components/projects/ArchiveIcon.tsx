'use client'

export const ARCHIVE_FOLDER_ID = '__archive__'
export const MOVE_OUT_TARGET_ID = '__move_out__'

type ArchiveIconProps = {
  count: number
  isDropTarget: boolean
  onClick: () => void
}

export function ArchiveIcon({ count, isDropTarget, onClick }: ArchiveIconProps) {
  return (
    <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center', padding: '6px 2px 2px' }}>
      <button
        data-archive-target={ARCHIVE_FOLDER_ID}
        onClick={onClick}
        className={`select-archive-btn${isDropTarget ? ' drop-target' : ''}`}
      >
        <span>Archive</span>
        {count > 0 && <span className="arc-count">{count}</span>}
      </button>
    </div>
  )
}
