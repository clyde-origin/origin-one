// POST /api/storyboard/generate
//
// Generates a storyboard image via Bria.ai text-to-image, uploads the bytes
// to the storyboard bucket under the canonical projectId-first convention
// (matching uploadStoryboardImage), and persists the public URL on
// Shot.imageUrl. All authorization flows through the caller's Supabase
// session — RLS on Shot/Scene/storage.objects enforces project membership.
//
// BRIA_API_TOKEN is server-only and read by generateStoryboard at call time.
//
// Bria's async polling can take 30–60s for a single image; route timeout is
// bumped to maxDuration = 90 to fit within Vercel's hobby/pro envelope.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { generateStoryboard } from '@/lib/bria/client'
import { briaAspect } from '@/lib/bria/aspect'

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

type GenerateBody = {
  projectId?: string
  shotId?: string
  prompt?: string
}

export async function POST(req: Request) {
  let body: GenerateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const { projectId, shotId, prompt } = body
  if (!projectId || !shotId || !prompt?.trim()) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  const trimmedPrompt = prompt.trim()
  if (trimmedPrompt.length > 2000) {
    return NextResponse.json({ error: 'prompt_too_long' }, { status: 400 })
  }

  const supabase = makeServerClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // RLS enforces SELECT on Shot/Scene/Project — if the caller can't read,
  // they get null back here and we return 404 (not 403, to avoid disclosing
  // the existence of the row).
  const { data: shot } = await supabase
    .from('Shot')
    .select('id, sceneId, Scene(projectId)')
    .eq('id', shotId)
    .maybeSingle()
  if (!shot) {
    return NextResponse.json({ error: 'shot_not_found' }, { status: 404 })
  }
  const sceneProjectId = (shot as { Scene?: { projectId?: string } | null }).Scene?.projectId
  if (sceneProjectId !== projectId) {
    return NextResponse.json({ error: 'shot_project_mismatch' }, { status: 400 })
  }

  const { data: project } = await supabase
    .from('Project')
    .select('aspectRatio')
    .eq('id', projectId)
    .maybeSingle()
  const aspect = briaAspect((project as { aspectRatio?: string | null } | null)?.aspectRatio)

  let bytes: Buffer
  try {
    const result = await generateStoryboard({ prompt: trimmedPrompt, aspectRatio: aspect.request })
    bytes = result.bytes
  } catch (err) {
    console.error('[storyboard/generate] Bria failed:', err)
    return NextResponse.json(
      { error: 'bria_failed', detail: (err as Error).message },
      { status: 502 }
    )
  }

  // Canonical path: <projectId>/<shotId>.jpg — matches uploadStoryboardImage.
  // RLS storyboard_insert enforces is_project_member on the projectId folder.
  const path = `${projectId}/${shotId}.jpg`
  const { error: uploadErr } = await supabase.storage
    .from('storyboard')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
  if (uploadErr) {
    console.error('[storyboard/generate] storage upload failed:', uploadErr)
    return NextResponse.json(
      { error: 'upload_failed', detail: uploadErr.message },
      { status: 500 }
    )
  }

  const { data: { publicUrl } } = supabase.storage.from('storyboard').getPublicUrl(path)

  const { error: updateErr } = await supabase
    .from('Shot')
    .update({ imageUrl: publicUrl })
    .eq('id', shotId)
  if (updateErr) {
    console.error('[storyboard/generate] Shot.imageUrl update failed:', updateErr)
    return NextResponse.json(
      { error: 'persist_failed', detail: updateErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ imageUrl: publicUrl })
}
