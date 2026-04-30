// POST /api/storyboard/preview
//
// Generates a storyboard image via Bria.ai and returns the raw bytes.
// Used by the New Shot sheet so the user can preview a Bria result before
// committing to a Shot row — once they like the preview they tap Save and
// the client uploads the held bytes through the normal storyboard flow.
//
// Distinct from /api/storyboard/generate which assumes an existing shotId
// and persists the image straight to Shot.imageUrl. The preview route
// requires only projectId for the project-membership check; no shot row,
// no storage write.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { generateStoryboard } from '@/lib/bria/client'
import { briaAspect } from '@/lib/bria/aspect'
import { buildStyledPrompt, DEFAULT_STORYBOARD_STYLE, type StoryboardStyle } from '@/lib/bria/style'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

function makeServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set(name, value, options) },
        remove(name: string, options: CookieOptions) { cookieStore.set(name, '', { ...options, maxAge: 0 }) },
      },
    }
  )
}

type PreviewBody = {
  projectId?: string
  prompt?: string
  style?: StoryboardStyle
}

const VALID_STYLES: ReadonlySet<StoryboardStyle> = new Set<StoryboardStyle>(['hand-drawn', 'colored', 'photo-real'])

export async function POST(req: Request) {
  let body: PreviewBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const { projectId, prompt, style } = body
  if (!projectId || !prompt?.trim()) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  const trimmedPrompt = prompt.trim()
  if (trimmedPrompt.length > 2000) {
    return NextResponse.json({ error: 'prompt_too_long' }, { status: 400 })
  }
  const resolvedStyle: StoryboardStyle = style && VALID_STYLES.has(style) ? style : DEFAULT_STORYBOARD_STYLE

  const supabase = makeServerClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // RLS-gated SELECT — if the caller can't read the project, they get null
  // and we 404 (not 403; consistent with /generate).
  const { data: project } = await supabase
    .from('Project')
    .select('id, aspectRatio')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) {
    return NextResponse.json({ error: 'project_not_found' }, { status: 404 })
  }

  const aspect = briaAspect((project as { aspectRatio?: string | null }).aspectRatio)

  let bytes: Buffer
  try {
    const styledPrompt = buildStyledPrompt(resolvedStyle, trimmedPrompt)
    const result = await generateStoryboard({ prompt: styledPrompt, aspectRatio: aspect.request })
    bytes = result.bytes
  } catch (err) {
    console.error('[storyboard/preview] Bria failed:', err)
    return NextResponse.json(
      { error: 'bria_failed', detail: (err as Error).message },
      { status: 502 }
    )
  }

  // Stream raw JPEG bytes back. Client converts to a Blob → Object URL for
  // the inline preview, then re-uploads via uploadStoryboardImage on Save.
  // Buffer → Uint8Array so the NextResponse BodyInit shape is satisfied.
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
