import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      '@tanstack/react-query',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
  compiler: {
    removeConsole: { exclude: ['error', 'warn'] },
  },
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
