import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/setup-password', '/auth/error']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const isPublic = PUBLIC_PATHS.some(p => request.nextUrl.pathname.startsWith(p))

  // Skip the auth refresh + getSession() round-trip for public routes —
  // they don't need a session and a fresh cookie won't change the response.
  if (isPublic) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refreshes the session cookie on every request before it expires.
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_next/data|favicon.ico|icons|manifest\\.webmanifest|manifest\\.json|sw\\.js|images/.*|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico)).*)'],
}
