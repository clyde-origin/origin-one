/**
 * ThreadsIcon — speech bubble with a horizontal line through the middle.
 * Used globally wherever threads is referenced (FABs, nav, headers).
 *
 * Props:
 *   size        — width & height in px (default 14)
 *   color       — stroke color (default "rgba(255,255,255,0.55)")
 *   strokeWidth — SVG stroke width (default 1.2)
 *   unreadCount — when > 0, shows a badge at top-right (default 0)
 *   badgeColor  — badge background (default "#67E8F9")
 */

interface ThreadsIconProps {
  size?: number
  color?: string
  strokeWidth?: number
  unreadCount?: number
  badgeColor?: string
}

export function ThreadsIcon({
  size = 14,
  color = 'rgba(255,255,255,0.55)',
  strokeWidth = 1.2,
  unreadCount = 0,
  badgeColor = '#67E8F9',
}: ThreadsIconProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        {/* Speech bubble */}
        <path
          d="M2 3a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 2.5V10H3a1 1 0 01-1-1V3z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        {/* Horizontal line through middle */}
        <path
          d="M5 6.5h6"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <div style={{
          position: 'absolute',
          top: -3,
          right: -4,
          minWidth: 14,
          height: 14,
          borderRadius: 7,
          background: badgeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 3px',
          border: '1.5px solid #04040a',
        }}>
          <span style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 8,
            fontWeight: 700,
            lineHeight: 1,
            color: '#04040a',
            letterSpacing: '-0.02em',
          }}>
            {unreadCount >= 10 ? '9+' : unreadCount}
          </span>
        </div>
      )}
    </div>
  )
}
