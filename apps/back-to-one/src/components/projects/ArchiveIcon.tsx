'use client'

export const ARCHIVE_FOLDER_ID = '__archive__'
export const MOVE_OUT_TARGET_ID = '__move_out__'

type ArchiveIconProps = {
  count: number            // archived projects count to show in label
  isDropTarget: boolean    // true while a drag is hovering
  onClick: () => void
}

export function ArchiveIcon({ count, isDropTarget, onClick }: ArchiveIconProps) {
  return (
    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', padding: '6px 2px 2px' }}>
      <button
        data-archive-target={ARCHIVE_FOLDER_ID}
        onClick={onClick}
        className="active:opacity-80 transition-all"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '10px 14px',
          borderRadius: 14,
          border: isDropTarget
            ? '1.5px solid rgba(232,86,74,0.7)'
            : '1px dashed rgba(98,98,122,0.3)',
          background: isDropTarget
            ? 'rgba(232,86,74,0.12)'
            : 'rgba(98,98,122,0.04)',
          boxShadow: isDropTarget
            ? '0 0 30px rgba(232,86,74,0.45), inset 0 0 18px rgba(232,86,74,0.15)'
            : 'none',
          transform: isDropTarget ? 'scale(1.06)' : 'scale(1)',
          transition: 'all 0.18s ease',
          cursor: 'pointer',
          color: isDropTarget ? '#e8564a' : '#62627a',
        }}
      >
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M2 4.5C2 3.4 2.9 2.5 4 2.5H8.5L10.5 4.5H18C19.1 4.5 20 5.4 20 6.5V14.5C20 15.6 19.1 16.5 18 16.5H4C2.9 16.5 2 15.6 2 14.5V4.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.1em' }}>
          Archive{count > 0 ? ` · ${count}` : ''}
        </span>
      </button>
    </div>
  )
}
