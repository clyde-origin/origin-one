import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

// ── Client-side (browser) ─────────────────────────────────

export function createBrowserAuthClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Server-side (Next.js route handlers, middleware) ──────

export function createServerAuthClient(
  cookies: () => {
    get: (name: string) => { value: string } | undefined;
    set: (name: string, value: string, options: Record<string, unknown>) => void;
    remove: (name: string, options: Record<string, unknown>) => void;
  }
): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.remove(name, options);
        },
      },
    }
  );
}
