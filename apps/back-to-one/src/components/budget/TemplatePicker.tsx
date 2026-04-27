'use client'

import { useState } from 'react'
import {
  useCreateBudgetFromTemplate,
  useCreateBlankBudget,
  useCreateBudgetByClone,
  useProjectsWithBudgets,
} from '@/lib/hooks/useOriginOne'
import { haptic } from '@/lib/utils/haptics'

// Empty-state budget creation flow. Three options on the entry card —
// AICP template, Clone from project, Blank — each routes through this
// component's internal state machine. Replace-in-place navigation: a
// back chevron in the header steps the same surface backwards rather
// than nesting modals (project rule).
//
// Currency is locked to USD for PR 11; the variance threshold is the
// only producer-editable initial setting. PR 12 will add the full
// settings sheet behind the budget header's "•••" menu.

type Step =
  | { kind: 'pick' }
  | { kind: 'aicp-settings' }
  | { kind: 'clone-source' }
  | { kind: 'blank-settings' }

interface TemplatePickerProps {
  projectId: string
  accent: string
  onCreated: () => void          // close + budget cache invalidates → page rerenders
  onCancel: () => void
}

export function TemplatePicker({ projectId, accent, onCreated, onCancel }: TemplatePickerProps) {
  const [step, setStep] = useState<Step>({ kind: 'pick' })

  return (
    <div
      style={{
        margin: '20px 16px 24px',
        padding: 16,
        borderRadius: 16,
        background: 'rgba(15,15,25,0.7)',
        border: '1px solid rgba(255,255,255,0.10)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <Header
        accent={accent}
        title={titleForStep(step)}
        canBack={step.kind !== 'pick'}
        onBack={() => { haptic('light'); setStep({ kind: 'pick' }) }}
        onClose={onCancel}
      />

      {step.kind === 'pick' && (
        <PickCards
          accent={accent}
          onPickAicp={() => { haptic('light'); setStep({ kind: 'aicp-settings' }) }}
          onPickClone={() => { haptic('light'); setStep({ kind: 'clone-source' }) }}
          onPickBlank={() => { haptic('light'); setStep({ kind: 'blank-settings' }) }}
        />
      )}

      {step.kind === 'aicp-settings' && (
        <InitialSettingsStep
          accent={accent}
          mode="template"
          projectId={projectId}
          onCreated={onCreated}
        />
      )}

      {step.kind === 'blank-settings' && (
        <InitialSettingsStep
          accent={accent}
          mode="blank"
          projectId={projectId}
          onCreated={onCreated}
        />
      )}

      {step.kind === 'clone-source' && (
        <CloneSourcePicker
          accent={accent}
          projectId={projectId}
          onCreated={onCreated}
        />
      )}
    </div>
  )
}

function titleForStep(step: Step): string {
  switch (step.kind) {
    case 'pick':            return 'Start budget'
    case 'aicp-settings':   return 'AICP template'
    case 'clone-source':    return 'Clone from project'
    case 'blank-settings':  return 'Blank budget'
  }
}

// ── Header (back chevron + title + close) ───────────────────────────────

function Header({
  accent, title, canBack, onBack, onClose,
}: {
  accent: string
  title: string
  canBack: boolean
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center" style={{ gap: 10 }}>
      {canBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', color: '#fff',
            fontSize: 18, cursor: 'pointer',
          }}
        >‹</button>
      ) : (
        <div style={{ width: 28 }} />
      )}
      <span
        className="font-mono uppercase"
        style={{ flex: 1, fontSize: 10, letterSpacing: '0.12em', color: accent }}
      >{title}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', color: '#62627a',
          fontSize: 14, cursor: 'pointer',
        }}
      >✕</button>
    </div>
  )
}

// ── Pick step (3 cards) ─────────────────────────────────────────────────

function PickCards({
  accent, onPickAicp, onPickClone, onPickBlank,
}: {
  accent: string
  onPickAicp: () => void
  onPickClone: () => void
  onPickBlank: () => void
}) {
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <Card
        accent={accent}
        eyebrow="Recommended"
        title="AICP template"
        body="14-account industry standard. Includes Contingency 10% and Agency Fee 5% as default markups."
        onTap={onPickAicp}
      />
      <Card
        accent={accent}
        eyebrow=""
        title="Clone from project"
        body="Copy the budget shape from another project on this team. Lines and version structure transfer; actuals do not."
        onTap={onPickClone}
      />
      <Card
        accent={accent}
        eyebrow=""
        title="Blank budget"
        body="Three empty versions. You build the account chart from scratch."
        onTap={onPickBlank}
      />
    </div>
  )
}

function Card({
  accent, eyebrow, title, body, onTap,
}: {
  accent: string
  eyebrow: string
  title: string
  body: string
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="text-left"
      style={{
        padding: 14, borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.10)',
        cursor: 'pointer', color: 'inherit',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      {eyebrow && (
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.12em', color: accent }}
        >{eyebrow}</span>
      )}
      <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{title}</span>
      <span style={{ fontSize: 12, color: '#a0a0b8', lineHeight: 1.5 }}>{body}</span>
    </button>
  )
}

// ── Initial settings (AICP / Blank flows) ───────────────────────────────

function InitialSettingsStep({
  accent, mode, projectId, onCreated,
}: {
  accent: string
  mode: 'template' | 'blank'
  projectId: string
  onCreated: () => void
}) {
  // Variance threshold stored as Decimal(5,4) string. Display percent;
  // store the decimal. 10% (default) → "0.10". Bound 0–100% inclusive.
  const [pct, setPct] = useState('10')

  const fromTemplate = useCreateBudgetFromTemplate(projectId)
  const blank        = useCreateBlankBudget(projectId)
  const isPending = fromTemplate.isPending || blank.isPending

  const handleSubmit = () => {
    const n = Number(pct)
    if (!Number.isFinite(n) || n < 0 || n > 100) return
    const varianceThreshold = (n / 100).toFixed(4)
    haptic('medium')
    const args = { projectId, currency: 'USD', varianceThreshold }
    const mutation = mode === 'template' ? fromTemplate : blank
    mutation.mutate(args, { onSuccess: () => onCreated() })
  }

  const valid = (() => {
    const n = Number(pct)
    return Number.isFinite(n) && n >= 0 && n <= 100
  })()

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <Field accent={accent} label="Currency" hint="Locked for v1 — multi-currency comes later.">
        <div
          className="font-mono"
          style={{
            padding: '10px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#a0a0b8', fontSize: 13,
          }}
        >USD</div>
      </Field>

      <Field
        accent={accent}
        label="Variance threshold"
        hint="Lines whose actuals exceed this percentage get flagged. Half this value triggers the warning band."
      >
        <div
          className="flex items-center"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, gap: 6,
          }}
        >
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={e => setPct(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: 'transparent', border: 'none',
              color: '#fff', fontSize: 13, outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span className="font-mono" style={{ fontSize: 12, color: '#62627a', paddingRight: 12 }}>%</span>
        </div>
      </Field>

      <div className="flex" style={{ gap: 8, marginTop: 4 }}>
        <PrimaryBtn
          accent={accent}
          disabled={!valid || isPending}
          onClick={handleSubmit}
          label={isPending ? 'Creating…' : 'Create budget'}
        />
      </div>
    </div>
  )
}

function Field({
  accent: _accent, label, hint, children,
}: {
  accent: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col" style={{ gap: 6 }}>
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: '0.12em', color: '#a0a0b8' }}
      >{label}</span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: '#62627a', lineHeight: 1.5 }}>{hint}</span>
      )}
    </label>
  )
}

// ── Clone source picker ─────────────────────────────────────────────────

function CloneSourcePicker({
  accent, projectId, onCreated,
}: {
  accent: string
  projectId: string
  onCreated: () => void
}) {
  const { data: candidates, isLoading } = useProjectsWithBudgets()
  const clone = useCreateBudgetByClone(projectId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const list = (candidates ?? []).filter(p => p.id !== projectId)

  const handleClone = () => {
    if (!selectedId) return
    haptic('medium')
    clone.mutate(
      { srcProjectId: selectedId, targetProjectId: projectId },
      { onSuccess: () => onCreated() },
    )
  }

  if (isLoading) {
    return (
      <div
        className="font-mono uppercase text-center"
        style={{ fontSize: 9, letterSpacing: '0.12em', color: '#62627a', padding: 20 }}
      >Loading projects…</div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="text-center" style={{ padding: '12px 4px 4px' }}>
        <div
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.12em', color: '#62627a', marginBottom: 6 }}
        >No source projects</div>
        <div style={{ fontSize: 12, color: '#a0a0b8', lineHeight: 1.5 }}>
          No other project on this team has a budget yet. Try the AICP template instead.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: '0.12em', color: '#a0a0b8' }}
      >Source project</span>
      <div className="flex flex-col" style={{ gap: 6, maxHeight: 280, overflowY: 'auto' }}>
        {list.map(p => {
          const active = p.id === selectedId
          const swatch = p.color ?? '#62627a'
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => { haptic('light'); setSelectedId(p.id) }}
              className="text-left"
              style={{
                padding: '10px 12px', borderRadius: 10,
                background: active ? `${accent}1a` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${active ? `${accent}55` : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', color: 'inherit',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <span
                style={{
                  width: 10, height: 10, borderRadius: 999,
                  background: swatch, flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: 13, color: '#fff' }}>{p.name}</span>
              {active && (
                <span style={{ color: accent, fontSize: 14 }}>✓</span>
              )}
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 11, color: '#62627a', lineHeight: 1.5, margin: 0 }}>
        Copies accounts, lines, version structure, variables, and markups. Actuals (expenses) are not cloned.
      </p>
      <div className="flex" style={{ gap: 8, marginTop: 4 }}>
        <PrimaryBtn
          accent={accent}
          disabled={!selectedId || clone.isPending}
          onClick={handleClone}
          label={clone.isPending ? 'Cloning…' : 'Clone budget'}
        />
      </div>
    </div>
  )
}

// ── Primary submit button ───────────────────────────────────────────────

function PrimaryBtn({
  accent, disabled, onClick, label,
}: {
  accent: string
  disabled: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono uppercase"
      style={{
        flex: 1,
        padding: '11px 14px', borderRadius: 10,
        fontSize: 10, letterSpacing: '0.10em',
        background: disabled ? 'rgba(255,255,255,0.04)' : `${accent}24`,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `${accent}66`}`,
        color: disabled ? '#62627a' : accent,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >{label}</button>
  )
}
