'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/utils/haptics'

export default function LoginPage() {
  const [name, setName] = useState('')
  const router = useRouter()

  // Skip login if name already stored
  useEffect(() => {
    const existing = localStorage.getItem('origin_one_user_name')
    if (existing) router.replace('/projects')
  }, [router])

  function handleEnter() {
    if (!name.trim()) return
    haptic('medium')
    localStorage.setItem('origin_one_user_name', name.trim())
    router.push('/projects')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleEnter()
  }

  return (
    <div className="relative w-full h-dvh overflow-hidden flex flex-col">

      {/* Background image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-top"
        style={{ backgroundImage: "url('/images/b21_bg.png')" }}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: 'linear-gradient(180deg, rgba(4,4,10,0.35) 0%, rgba(4,4,10,0.1) 30%, rgba(4,4,10,0.2) 55%, rgba(4,4,10,0.82) 75%, rgba(4,4,10,0.97) 100%)',
        }}
      />

      {/* Spacer */}
      <div className="flex-1 z-20 relative" />

      {/* Form */}
      <div className="relative z-20 px-8 pb-14 flex-shrink-0">

        <p className="font-mono text-[0.44rem] tracking-[0.28em] uppercase text-white/30 mb-7">
          Origin Point
        </p>

        <label className="block font-mono text-[0.42rem] tracking-[0.18em] uppercase text-white/35 mb-2">
          Your name
        </label>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Clyde"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl px-4 py-3.5 text-[0.92rem] font-semibold text-text placeholder:text-white/20 outline-none mb-3 transition-colors border border-white/10 focus:border-white/25"
          style={{
            background: 'rgba(4,4,10,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        />

        <button
          onClick={handleEnter}
          disabled={!name.trim()}
          className="w-full py-3.5 rounded-xl font-bold text-[0.88rem] text-[#04040a] transition-opacity active:scale-[0.98] disabled:opacity-25"
          style={{ background: 'rgba(255,255,255,0.92)' }}
        >
          Enter
        </button>

        <p className="font-mono text-[0.38rem] tracking-[0.2em] uppercase text-white/[0.14] text-center mt-4">
          Origin One &middot; Back to One
        </p>

      </div>
    </div>
  )
}
