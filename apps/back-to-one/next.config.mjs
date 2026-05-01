/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prep for the next/image migration. The codebase currently uses raw
  // <img> tags (StorageImage, panel covers, mood/storyboard etc.), so
  // these settings have no runtime effect today — they take effect as
  // pages migrate to next/image. Adding the config now means each
  // migration is a one-liner instead of also editing this file.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Supabase Storage public + signed URLs from any project ref.
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
      // Local Supabase (supabase start) for dev.
      { protocol: 'http',  hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/**' },
      { protocol: 'http',  hostname: 'localhost',  port: '54321', pathname: '/storage/v1/object/**' },
    ],
  },
}
export default nextConfig
