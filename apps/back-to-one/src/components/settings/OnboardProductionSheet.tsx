'use client'

import { useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { useOnboardProduction } from '@/lib/hooks/useOriginOne'
import { haptic } from '@/lib/utils/haptics'

type ProducerRow = { name: string; email: string }

const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#e8e8ea',
  padding: '12px 14px',
  fontSize: 15,
  outline: 'none',
}

const labelBase: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#7c7c8a',
  marginBottom: 6,
}

export function OnboardProductionSheet({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const onboard = useOnboardProduction()
  const [companyName, setCompanyName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [producers, setProducers] = useState<ProducerRow[]>([{ name: '', email: '' }])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function updateProducer(idx: number, patch: Partial<ProducerRow>) {
    setProducers(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }
  function addProducer() {
    haptic('light')
    setProducers(prev => [...prev, { name: '', email: '' }])
  }
  function removeProducer(idx: number) {
    haptic('light')
    setProducers(prev => prev.filter((_, i) => i !== idx))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    haptic('medium')
    try {
      const result = await onboard.mutateAsync({ companyName, projectName, producers })
      const sentCount = result.emails.filter(e => e.ok).length
      const failedCount = result.emails.length - sentCount
      setSuccess(
        failedCount === 0
          ? `Production created. ${sentCount} invite${sentCount === 1 ? '' : 's'} sent.`
          : `Production created. ${sentCount} invite${sentCount === 1 ? '' : 's'} sent, ${failedCount} failed (resend manually from Crew page).`
      )
      // Reset form so a second onboarding starts clean.
      setCompanyName('')
      setProjectName('')
      setProducers([{ name: '', email: '' }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'creation failed')
    }
  }

  const submitDisabled =
    onboard.isPending ||
    !companyName.trim() ||
    !projectName.trim() ||
    producers.length === 0 ||
    producers.some(p => !p.name.trim() || !p.email.trim())

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title="Onboard external production" onClose={onClose} />
      <SheetBody>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelBase} htmlFor="company">Production company</label>
            <input
              id="company"
              type="text"
              autoFocus
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. THNK Elephant"
              maxLength={80}
              style={inputBase}
            />
          </div>

          <div>
            <label style={labelBase} htmlFor="project">Starter project</label>
            <input
              id="project"
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Office Pool"
              maxLength={80}
              style={inputBase}
            />
          </div>

          <div>
            <span style={labelBase}>Producers</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {producers.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8 }}>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updateProducer(i, { name: e.target.value })}
                    placeholder="Name"
                    maxLength={80}
                    style={inputBase}
                  />
                  <input
                    type="email"
                    value={p.email}
                    onChange={e => updateProducer(i, { email: e.target.value })}
                    placeholder="email@example.com"
                    style={inputBase}
                  />
                  <button
                    type="button"
                    onClick={() => removeProducer(i)}
                    disabled={producers.length <= 1}
                    aria-label="Remove producer"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: producers.length <= 1 ? '#3a3a4a' : '#7c7c8a',
                      cursor: producers.length <= 1 ? 'default' : 'pointer',
                      fontSize: 18,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addProducer}
              style={{
                marginTop: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#bdbdc6',
                padding: '10px 14px',
                fontSize: 14,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              + Add producer
            </button>
          </div>

          {error && (
            <div style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.3)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#ffa8a8' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: 'rgba(80,180,120,0.08)', border: '1px solid rgba(80,180,120,0.3)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#9be0b8' }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            style={{
              background: submitDisabled ? 'rgba(100,112,243,0.4)' : '#6470f3',
              color: '#04040a',
              border: 'none',
              borderRadius: 14,
              padding: '14px 24px',
              fontSize: 15,
              fontWeight: 600,
              cursor: submitDisabled ? 'default' : 'pointer',
            }}
          >
            {onboard.isPending ? 'Creating…' : 'Create production'}
          </button>
        </form>
      </SheetBody>
    </Sheet>
  )
}
