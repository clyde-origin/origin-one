import { redirect } from 'next/navigation'

// Authenticated users hit this page only briefly — middleware lets them
// through (path is not in PUBLIC_PATHS, but session exists) and we punt
// to the project picker. Unauth'd users never get here — middleware
// redirects them to /login first.
export default function RootPage() {
  redirect('/projects')
}
