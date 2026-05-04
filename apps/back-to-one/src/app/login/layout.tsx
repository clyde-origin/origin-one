import { Cormorant_Garamond } from 'next/font/google'

// Cinema Glass display serif — used on the Login brand title and
// other "Cormorant Garamond · Login Title" treatments. Scoped to the
// login route group so it isn't loaded on every page of the app.
const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-cormorant-garamond',
  display: 'swap',
})

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={cormorantGaramond.variable}>{children}</div>
}
