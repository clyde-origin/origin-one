'use client'

import { useEffect, useState } from 'react'
import type { CallSheet, ShootDay, Project, ScheduleBlock, ProjectTalent, Location } from '@/types'
import { CallSheetView } from './CallSheetView'
import { deriveCallSheetViewModel } from '@/lib/call-sheet/derive-view-model'
import { useUpdateCallSheet, useUploadCallSheetAttachment, useDeleteCallSheetAttachment } from '@/lib/hooks/useOriginOne'

type FormState = {
  title: string
  subtitle: string
  episodeOrEvent: string
  generalCallTime: string
  crewCallTime: string
  shootingCallTime: string
  lunchTime: string
  estWrapTime: string
  weatherTempHigh: string
  weatherTempLow: string
  weatherCondition: string
  sunriseTime: string
  sunsetTime: string
  nearestHospitalName: string
  nearestHospitalAddress: string
  nearestHospitalPhone: string
  productionNotes: string
  parkingNotes: string
  includeSchedule: boolean
  replyToEmail: string
}

function csToForm(cs: CallSheet): FormState {
  return {
    title: cs.title ?? '',
    subtitle: cs.subtitle ?? '',
    episodeOrEvent: cs.episodeOrEvent ?? '',
    generalCallTime: cs.generalCallTime ?? '',
    crewCallTime: cs.crewCallTime ?? '',
    shootingCallTime: cs.shootingCallTime ?? '',
    lunchTime: cs.lunchTime ?? '',
    estWrapTime: cs.estWrapTime ?? '',
    weatherTempHigh: cs.weatherTempHigh != null ? String(cs.weatherTempHigh) : '',
    weatherTempLow: cs.weatherTempLow != null ? String(cs.weatherTempLow) : '',
    weatherCondition: cs.weatherCondition ?? '',
    sunriseTime: cs.sunriseTime ?? '',
    sunsetTime: cs.sunsetTime ?? '',
    nearestHospitalName: cs.nearestHospitalName ?? '',
    nearestHospitalAddress: cs.nearestHospitalAddress ?? '',
    nearestHospitalPhone: cs.nearestHospitalPhone ?? '',
    productionNotes: cs.productionNotes ?? '',
    parkingNotes: cs.parkingNotes ?? '',
    includeSchedule: cs.includeSchedule,
    replyToEmail: cs.replyToEmail ?? '',
  }
}

export function ComposeTab({
  project,
  callSheet,
  shootDay,
  schedule,
  talent,
  crew,
  locations,
}: {
  project: Project
  callSheet: CallSheet
  shootDay: ShootDay
  schedule: ScheduleBlock[]
  talent: ProjectTalent[]
  crew: any[]
  locations: Location[]
}) {
  const [form, setForm] = useState<FormState>(() => csToForm(callSheet))
  const [savingHint, setSavingHint] = useState<'idle' | 'saving' | 'saved'>('idle')
  const update = useUpdateCallSheet(callSheet.id)
  const uploadAttachment = useUploadCallSheetAttachment(callSheet.id)
  const deleteAttachment = useDeleteCallSheetAttachment(callSheet.id)

  // Sync from server when callSheet changes externally (e.g. after upload)
  useEffect(() => {
    setForm(csToForm(callSheet))
  }, [callSheet.id, callSheet.updatedAt])

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // Debounced save
  useEffect(() => {
    setSavingHint('saving')
    const t = setTimeout(async () => {
      const fields = {
        title: form.title.trim() || null,
        subtitle: form.subtitle.trim() || null,
        episodeOrEvent: form.episodeOrEvent.trim() || null,
        generalCallTime: form.generalCallTime || null,
        crewCallTime: form.crewCallTime || null,
        shootingCallTime: form.shootingCallTime || null,
        lunchTime: form.lunchTime || null,
        estWrapTime: form.estWrapTime || null,
        weatherTempHigh: form.weatherTempHigh ? Number(form.weatherTempHigh) : null,
        weatherTempLow: form.weatherTempLow ? Number(form.weatherTempLow) : null,
        weatherCondition: form.weatherCondition.trim() || null,
        sunriseTime: form.sunriseTime || null,
        sunsetTime: form.sunsetTime || null,
        nearestHospitalName: form.nearestHospitalName.trim() || null,
        nearestHospitalAddress: form.nearestHospitalAddress.trim() || null,
        nearestHospitalPhone: form.nearestHospitalPhone.trim() || null,
        productionNotes: form.productionNotes.trim() || null,
        parkingNotes: form.parkingNotes.trim() || null,
        includeSchedule: form.includeSchedule,
        replyToEmail: form.replyToEmail.trim() || null,
      }
      try {
        await update.mutateAsync({ id: callSheet.id, fields })
        setSavingHint('saved')
        setTimeout(() => setSavingHint('idle'), 1500)
      } catch {
        setSavingHint('idle')
      }
    }, 800)
    return () => clearTimeout(t)
  }, [form])

  // Build view model from current form state for live preview
  const previewCallSheet: CallSheet = {
    ...callSheet,
    title: form.title || null,
    subtitle: form.subtitle || null,
    episodeOrEvent: form.episodeOrEvent || null,
    generalCallTime: form.generalCallTime || null,
    crewCallTime: form.crewCallTime || null,
    shootingCallTime: form.shootingCallTime || null,
    lunchTime: form.lunchTime || null,
    estWrapTime: form.estWrapTime || null,
    weatherTempHigh: form.weatherTempHigh ? Number(form.weatherTempHigh) : null,
    weatherTempLow: form.weatherTempLow ? Number(form.weatherTempLow) : null,
    weatherCondition: form.weatherCondition || null,
    sunriseTime: form.sunriseTime || null,
    sunsetTime: form.sunsetTime || null,
    nearestHospitalName: form.nearestHospitalName || null,
    nearestHospitalAddress: form.nearestHospitalAddress || null,
    nearestHospitalPhone: form.nearestHospitalPhone || null,
    productionNotes: form.productionNotes || null,
    parkingNotes: form.parkingNotes || null,
    includeSchedule: form.includeSchedule,
  }

  const vm = deriveCallSheetViewModel({
    project,
    callSheet: previewCallSheet,
    shootDay,
    schedule,
    talent,
    crew,
    locations,
  })

  return (
    <div className="grid lg:grid-cols-2 gap-6 px-4 lg:px-8 pb-24 max-w-7xl mx-auto">
      {/* Form */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ background: savingHint === 'saving' ? '#fbbf24' : savingHint === 'saved' ? '#34d399' : '#62627a' }} />
          <span className="text-white/50 font-mono uppercase tracking-wider">
            {savingHint === 'saving' ? 'Saving...' : savingHint === 'saved' ? 'Saved' : 'Auto-saves as you type'}
          </span>
        </div>

        <Section title="Header">
          <Field label="Title">
            <Input value={form.title} onChange={v => patch('title', v)} placeholder="Gibbon Slackboard" />
          </Field>
          <Field label="Subtitle">
            <Input value={form.subtitle} onChange={v => patch('subtitle', v)} placeholder='"One Step"' />
          </Field>
          <Field label="Episode / Event">
            <Input value={form.episodeOrEvent} onChange={v => patch('episodeOrEvent', v)} placeholder="DAY 1 OF 2" />
          </Field>
        </Section>

        <Section title="Times">
          <div className="grid grid-cols-2 gap-3">
            <Field label="General Call"><TimeInput value={form.generalCallTime} onChange={v => patch('generalCallTime', v)} /></Field>
            <Field label="Crew Call"><TimeInput value={form.crewCallTime} onChange={v => patch('crewCallTime', v)} /></Field>
            <Field label="Shooting Call"><TimeInput value={form.shootingCallTime} onChange={v => patch('shootingCallTime', v)} /></Field>
            <Field label="Lunch"><TimeInput value={form.lunchTime} onChange={v => patch('lunchTime', v)} /></Field>
            <Field label="Est. Wrap"><TimeInput value={form.estWrapTime} onChange={v => patch('estWrapTime', v)} /></Field>
          </div>
        </Section>

        <Section title="Weather">
          <div className="grid grid-cols-3 gap-3">
            <Field label="High °F"><Input type="number" value={form.weatherTempHigh} onChange={v => patch('weatherTempHigh', v)} /></Field>
            <Field label="Low °F"><Input type="number" value={form.weatherTempLow} onChange={v => patch('weatherTempLow', v)} /></Field>
            <Field label="Condition"><Input value={form.weatherCondition} onChange={v => patch('weatherCondition', v)} placeholder="Sunny" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sunrise"><TimeInput value={form.sunriseTime} onChange={v => patch('sunriseTime', v)} /></Field>
            <Field label="Sunset"><TimeInput value={form.sunsetTime} onChange={v => patch('sunsetTime', v)} /></Field>
          </div>
        </Section>

        <Section title="Hospital">
          <Field label="Name"><Input value={form.nearestHospitalName} onChange={v => patch('nearestHospitalName', v)} /></Field>
          <Field label="Address"><Textarea value={form.nearestHospitalAddress} onChange={v => patch('nearestHospitalAddress', v)} rows={2} /></Field>
          <Field label="Phone"><Input value={form.nearestHospitalPhone} onChange={v => patch('nearestHospitalPhone', v)} placeholder="(310) 555-0100" /></Field>
        </Section>

        <Section title="Notes">
          <Field label="Production Notes"><Textarea value={form.productionNotes} onChange={v => patch('productionNotes', v)} rows={4} /></Field>
          <Field label="Parking"><Textarea value={form.parkingNotes} onChange={v => patch('parkingNotes', v)} rows={3} /></Field>
        </Section>

        <Section title="Schedule">
          <label className="flex items-center gap-3 text-sm text-white/80">
            <input type="checkbox" checked={form.includeSchedule} onChange={e => patch('includeSchedule', e.target.checked)} className="w-4 h-4" />
            Include the daily schedule on the call sheet
          </label>
        </Section>

        <Section title="Reply-to email">
          <Field label="Email">
            <Input
              type="email"
              value={form.replyToEmail}
              onChange={v => patch('replyToEmail', v)}
              placeholder="production@your-domain.com"
            />
          </Field>
          <p className="text-xs text-white/40 leading-relaxed">
            When recipients hit reply on the call sheet email, replies route here.
          </p>
        </Section>

        <Section title="Attachments">
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              await uploadAttachment.mutateAsync({ callSheetId: callSheet.id, file })
              e.target.value = ''
            }}
            className="text-sm text-white/70"
          />
          {callSheet.attachmentPaths.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {callSheet.attachmentPaths.map(p => {
                const filename = p.split('/').pop() ?? p
                return (
                  <li key={p} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                    <span className="text-white/80 truncate">{filename}</span>
                    <button
                      onClick={() => deleteAttachment.mutate({ callSheetId: callSheet.id, path: p })}
                      className="text-red-300 hover:text-red-200 text-xs px-2"
                    >
                      Remove
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* Preview */}
      <div className="hidden lg:block sticky top-4 self-start">
        <p className="font-mono uppercase tracking-wider text-[10px] text-white/40 mb-2">Live Preview</p>
        <div className="overflow-y-auto max-h-[calc(100vh-100px)] pr-2">
          <CallSheetView vm={vm} />
        </div>
      </div>

      {/* Mobile preview link */}
      <div className="lg:hidden mt-6">
        <details className="bg-white/5 border border-white/10 rounded-2xl">
          <summary className="cursor-pointer px-4 py-3 font-mono uppercase tracking-wider text-[11px] text-white/70">Show live preview</summary>
          <div className="p-2">
            <CallSheetView vm={vm} />
          </div>
        </details>
      </div>
    </div>
  )
}

// ── small primitives ────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono uppercase tracking-widest text-[10px] text-white/40">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono uppercase tracking-wider text-[10px] text-white/45">{label}</span>
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30"
    />
  )
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
    />
  )
}

function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 resize-none"
    />
  )
}
