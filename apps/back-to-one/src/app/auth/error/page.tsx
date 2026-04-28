'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const MESSAGES: Record<string, string> = {
  conflict: "There's already an account using this email. Contact a producer.",
  'incomplete-invite': 'Your invitation is incomplete. Contact a producer to resend.',
  'no-code': 'Sign-in link missing or expired. Try signing in again.',
  'exchange-failed': 'Sign-in link expired or already used. Try signing in again.',
  'no-user': 'Could not load your session. Try signing in again.',
  unknown: 'Something went wrong. Try signing in again, or contact a producer.',
}

function ErrorBody() {
  const code = useSearchParams().get('code') ?? 'unknown'
  return (
    <div style={{ width: '100%', maxWidth: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sign-in problem</h1>
      <p style={{ fontSize: '0.84rem', color: '#a0a0b0', lineHeight: 1.5 }}>
        {MESSAGES[code] ?? MESSAGES.unknown}
      </p>
      <Link href="/login" style={{ color: '#6470f3', fontSize: '0.82rem', fontWeight: 600 }}>
        Back to sign in
      </Link>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <main style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#04040a', color: '#dddde8', padding: '0 32px',
    }}>
      <Suspense fallback={<div />}>
        <ErrorBody />
      </Suspense>
    </main>
  )
}
