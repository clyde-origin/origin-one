import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { bindAuthUser } from '@/lib/auth/binding'
import { safeRedirectPath } from '@/lib/auth/server-authz'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect'), '/projects')

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?code=no-code', url.origin))
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
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
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeErr) {
    console.error('callback: code exchange failed', exchangeErr)
    return NextResponse.redirect(new URL('/auth/error?code=exchange-failed', url.origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.redirect(new URL('/auth/error?code=no-user', url.origin))
  }

  const result = await bindAuthUser(user.id, user.email, user.app_metadata ?? {})
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/auth/error?code=${result.code}`, url.origin))
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin))
}
