// Storyboard image-style presets. Bria text-to-image only takes free-form
// prompt text plus aspect ratio; style direction is shaped entirely by the
// prompt. We prepend a style preamble to the user's description so the
// "what" stays in their words and the "look" stays consistent across shots.
//
// Order matches the picker in the UI; the default is what surfaces first
// in any new sheet. Adjust the preambles based on what reads best in
// review — they're tunable copy, not load-bearing config.

export type StoryboardStyle = 'hand-drawn' | 'colored' | 'photo-real'

export const DEFAULT_STORYBOARD_STYLE: StoryboardStyle = 'hand-drawn'

export const STORYBOARD_STYLES: { value: StoryboardStyle; label: string }[] = [
  { value: 'hand-drawn', label: 'Hand-drawn' },
  { value: 'colored',    label: 'Colored' },
  { value: 'photo-real', label: 'Photo-real' },
]

const PREAMBLE: Record<StoryboardStyle, string> = {
  'hand-drawn':
    'Hand-drawn black and white pencil storyboard sketch on white paper. Rough graphite lines, visible construction lines, minimal shading, no color, NO photorealism, NO 3D rendering, NO digital painting. Looks like a film storyboard artist drew it quickly with a pencil. Illustrated, not rendered. Subject: ',
  'colored':
    'Hand-drawn storyboard panel with loose colored marker fills over visible pencil line art. Sketchy and illustrated — NOT photorealistic, NOT a 3D render, NOT a digital painting, NOT a photograph. Looks like a film board artist drew it with markers and pencils on paper: flat color washes, simple shading, visible pencil construction lines. Subject: ',
  'photo-real':
    'Photorealistic cinematic film still, natural lighting, in-camera framing, shallow depth of field. Subject: ',
}

export function buildStyledPrompt(style: StoryboardStyle, userPrompt: string): string {
  return `${PREAMBLE[style]}${userPrompt.trim()}`
}
