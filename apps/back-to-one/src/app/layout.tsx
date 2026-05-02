import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { QueryProvider } from '@/lib/query/provider'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'Back to One', template: '%s · Back to One' },
  description: 'Production alignment for Origin Point',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Back to One',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#04040a',
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" />
        {/* Cinema Glass theme bootstrap — runs before paint to avoid FOUC.
            No toggle UI is shipped in this PR (visual-only re-skin). Reviewers
            verify light mode by switching system color-scheme or by setting
            localStorage.theme='light' in DevTools. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: light)').matches;var L=(s==='light'||(s==null&&m));if(L){document.documentElement.classList.add('light-mode');var apply=function(){document.body&&document.body.classList.add('light-mode')};if(document.body){apply()}else{document.addEventListener('DOMContentLoaded',apply,{once:true})}}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  )
}
