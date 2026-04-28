'use client'

import { useQuery } from '@tanstack/react-query'
import { createBrowserAuthClient } from '@origin-one/auth'

const SIGN_TTL_SECONDS = 3600 // 1 hour

/**
 * Parse a Supabase publicUrl and extract bucket + path.
 * Format: https://<host>/storage/v1/object/public/<bucket>/<path>
 */
function parsePublicUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (!match) return null
  return { bucket: match[1], path: decodeURIComponent(match[2]) }
}

/**
 * Returns a signed URL for a private-bucket image, or pass-through for
 * public buckets / external URLs. After Auth Day, moodboard/storyboard/
 * entity-attachments are private — getPublicUrl-style links return 401
 * without a signed token. avatars remains public for display.
 */
export function useStorageImage(publicUrl: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ['storageSign', publicUrl],
    queryFn: async (): Promise<string | null> => {
      if (!publicUrl) return null

      // External URLs and blob: previews — pass through.
      if (!publicUrl.includes('/storage/v1/object/')) return publicUrl
      if (publicUrl.startsWith('blob:') || publicUrl.startsWith('data:')) return publicUrl

      const parsed = parsePublicUrl(publicUrl)
      if (!parsed) return publicUrl

      // avatars bucket stays public — no signing required.
      if (parsed.bucket === 'avatars') return publicUrl

      const db = createBrowserAuthClient()
      const { data, error } = await db.storage.from(parsed.bucket).createSignedUrl(parsed.path, SIGN_TTL_SECONDS)
      if (error || !data?.signedUrl) {
        if (error) console.error(`createSignedUrl failed for ${parsed.bucket}/${parsed.path}:`, error)
        return null
      }
      return data.signedUrl
    },
    enabled: !!publicUrl,
    staleTime: (SIGN_TTL_SECONDS - 60) * 1000, // refetch 1 minute before expiry
  })
  return data ?? null
}
