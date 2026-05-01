'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { CrewAvatar } from '@/components/ui'
import { useMe, useUploadAvatar } from '@/lib/hooks/useOriginOne'
import { createBrowserAuthClient } from '@origin-one/auth'
import { haptic } from '@/lib/utils/haptics'
import pkg from '../../../package.json'

type ThemeChoice = 'light' | 'dark'
const THEME_STORAGE_KEY = 'theme-preference'
const THEME_OPTIONS: ThemeChoice[] = ['light', 'dark']

function readStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'dark'
  const v = window.localStorage.getItem(THEME_STORAGE_KEY)
  return v === 'light' ? 'light' : 'dark'
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const me = useMe()
  const upload = useUploadAvatar()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [theme, setTheme] = useState<ThemeChoice>(() => readStoredTheme())
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function pickAvatar() {
    if (!me) return
    setUploadError(null)
    fileRef.current?.click()
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so the same file can be picked again
    if (!file || !me) return
    haptic('light')
    try {
      await upload.mutateAsync({ file, userId: me.id })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Avatar upload failed')
    }
  }

  function chooseTheme(next: ThemeChoice) {
    haptic('light')
    setTheme(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    }
  }

  async function reallySignOut() {
    haptic('medium')
    const supabase = createBrowserAuthClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title="Settings" onClose={onClose} />
      <SheetBody>
        {/* Avatar block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={pickAvatar}
            disabled={!me || upload.isPending}
            style={{
              position: 'relative', background: 'none', border: 'none', padding: 0,
              cursor: me ? 'pointer' : 'default', borderRadius: '50%',
            }}
            aria-label="Change avatar"
          >
            <CrewAvatar name={me?.name ?? '—'} size={64} avatarUrl={me?.avatarUrl ?? undefined} />
            {upload.isPending && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#dddde8', fontFamily: 'var(--font-geist-mono)',
              }}>
                …
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onAvatarFile}
            style={{ display: 'none' }}
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#dddde8' }}>{me?.name ?? '—'}</div>
            <div className="font-mono" style={{ fontSize: 11, color: '#62627a', marginTop: 2 }}>{me?.email ?? '—'}</div>
          </div>
          <div aria-live="polite" style={{ minHeight: 14 }}>
            {uploadError && (
              <div className="font-mono" style={{ fontSize: 10, color: 'rgba(232,72,72,0.9)', textAlign: 'center', marginTop: 2 }}>
                {uploadError}
              </div>
            )}
          </div>
        </div>

        {/* Theme */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="font-mono uppercase" style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.08em', marginBottom: 8 }}>Theme</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {THEME_OPTIONS.map(opt => {
              const active = theme === opt
              return (
                <button
                  key={opt}
                  onClick={() => chooseTheme(opt)}
                  className="font-mono capitalize"
                  style={{
                    flex: 1, fontSize: 11, padding: '8px 0', borderRadius: 20, cursor: 'pointer',
                    background: active ? 'rgba(196,90,220,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(196,90,220,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? '#c45adc' : '#62627a',
                  }}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sign out */}
        <div style={{ padding: '14px 0' }}>
          {confirmingSignOut ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#dddde8' }}>Sign out?</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setConfirmingSignOut(false)}
                  style={{
                    padding: '7px 14px', borderRadius: 7, fontSize: 12,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#a0a0b8', cursor: 'pointer',
                  }}
                >Cancel</button>
                <button
                  onClick={reallySignOut}
                  style={{
                    padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                    background: 'rgba(232,160,32,0.12)', border: '1px solid rgba(232,160,32,0.4)',
                    color: '#e8a020', cursor: 'pointer',
                  }}
                >Sign out</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingSignOut(true)}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.25)',
                color: '#e8a020', cursor: 'pointer', textAlign: 'left',
              }}
            >
              Sign out
            </button>
          )}
        </div>

        {/* Version footer */}
        <div className="font-mono" style={{ fontSize: 10, color: '#62627a', textAlign: 'center', paddingTop: 14 }}>
          back-to-one v{pkg.version}
        </div>
      </SheetBody>
    </Sheet>
  )
}
