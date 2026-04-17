export function haptic(style: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (typeof window === 'undefined') return
  if (!('vibrate' in navigator)) return
  const patterns: Record<string, number | number[]> = {
    light:   8,
    medium:  15,
    success: [8, 50, 8],
    warning: 20,
  }
  navigator.vibrate(patterns[style])
}
