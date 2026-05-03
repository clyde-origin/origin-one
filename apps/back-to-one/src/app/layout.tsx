import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Cormorant_Garamond } from 'next/font/google'
import { QueryProvider } from '@/lib/query/provider'
import '@/styles/globals.css'

// Cinema Glass display serif — used on the Login brand title and
// other "Cormorant Garamond · Login Title" treatments.
const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-cormorant-garamond',
  display: 'swap',
})

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${cormorantGaramond.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" />
        {/* Cinema Glass theme bootstrap — runs before paint to avoid FOUC.
            DESIGN_LANGUAGE.md: dark is the default; light mode is opt-in via
            body.light-mode. Light is applied only when localStorage.theme is
            explicitly 'light' — system prefers-color-scheme is ignored on
            purpose so dark stays canonical. Reviewers verify light mode in
            DevTools: localStorage.setItem('theme','light'); location.reload(). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.add('light-mode');var apply=function(){document.body&&document.body.classList.add('light-mode')};if(document.body){apply()}else{document.addEventListener('DOMContentLoaded',apply,{once:true})}}}catch(e){}})();`,
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
