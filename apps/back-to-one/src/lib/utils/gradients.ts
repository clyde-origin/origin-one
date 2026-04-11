// ── AVATAR GRADIENTS — used for crew color assignment ────
export const AVATAR_GRADIENTS: [string, string][] = [
  ['#6470f3', '#a78bfa'], ['#e8a020', '#f59e0b'], ['#00b894', '#34d399'],
  ['#f472b6', '#ec4899'], ['#38bdf8', '#0ea5e9'], ['#fb923c', '#f97316'],
  ['#a78bfa', '#c084fc'], ['#4ade80', '#22c55e'], ['#f87171', '#ef4444'],
]

export function pickGradient(index: number) {
  const g = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
  return { color1: g[0], color2: g[1] }
}

// ── MOODBOARD GRADIENTS — placeholder backgrounds ───────
export const MOODBOARD_GRADIENTS = [
  'linear-gradient(135deg,#1a0a30,#3a1060)',
  'linear-gradient(135deg,#0a1428,#1a3050)',
  'linear-gradient(135deg,#2a1808,#4a2810)',
  'linear-gradient(135deg,#080820,#1a1840)',
  'linear-gradient(135deg,#182010,#2a3818)',
  'linear-gradient(135deg,#280a18,#4a1030)',
]
