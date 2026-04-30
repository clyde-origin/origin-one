'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { useCreateScheduleBlock, useUpdateScheduleBlock, useDeleteScheduleBlock, useLocations, useProjectTalent } from '@/lib/hooks/useOriginOne'
import type { ScheduleBlock, ScheduleBlockKind, ScheduleBlockTrack } from '@/types'

const TRACK_LABEL: Record<ScheduleBlockTrack, string> = {
  main: 'Main',
  secondary: 'Secondary',
  tertiary: 'Tertiary',
}

const KIND_LABEL: Record<ScheduleBlockKind, string> = {
  work: 'Work',
  load_in: 'Load In',
  talent_call: 'Talent Call',
  lunch: 'Lunch',
  wrap: 'Wrap Out',
  tail_lights: 'Tail Lights',
  meal_break: 'Meal Break',
  custom: 'Custom',
}

const FULL_WIDTH_KINDS: ReadonlyArray<ScheduleBlockKind> = [
  'load_in', 'talent_call', 'lunch', 'wrap', 'tail_lights', 'meal_break', 'custom',
]

type FormState = {
  track: ScheduleBlockTrack
  kind: ScheduleBlockKind
  startTime: string
  endTime: string
  description: string
  customLabel: string
  locationId: string
  talentIds: string[]
}

function blockToForm(b: ScheduleBlock | null): FormState {
  return {
    track: b?.track ?? 'main',
    kind: b?.kind ?? 'work',
    startTime: b?.startTime ?? '08:00',
    endTime: b?.endTime ?? '08:30',
    description: b?.description ?? '',
    customLabel: b?.customLabel ?? '',
    locationId: b?.locationId ?? '',
    talentIds: b?.talentIds ?? [],
  }
}

export function AddScheduleBlockSheet({
  open,
  onClose,
  projectId,
  shootDayId,
  editingBlock,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  shootDayId: string
  editingBlock: ScheduleBlock | null
}) {
  const { data: locations = [] } = useLocations(projectId)
  const { data: talent = [] } = useProjectTalent(projectId)

  const [form, setForm] = useState<FormState>(() => blockToForm(editingBlock))

  // Reset form when editingBlock changes (sheet reopens with different row)
  useEffect(() => {
    setForm(blockToForm(editingBlock))
  }, [editingBlock?.id, open])

  const createMut = useCreateScheduleBlock(shootDayId)
  const updateMut = useUpdateScheduleBlock(shootDayId)
  const deleteMut = useDeleteScheduleBlock(shootDayId)

  const isFullWidth = FULL_WIDTH_KINDS.includes(form.kind)
  const saving = createMut.isPending || updateMut.isPending

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleId(arr: string[], id: string) {
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]
  }

  async function save() {
    const payload = {
      track: form.track,
      kind: form.kind,
      startTime: form.startTime,
      endTime: form.endTime || null,
      description: form.description.trim(),
      customLabel: form.customLabel.trim() || null,
      locationId: form.locationId || null,
      talentIds: form.talentIds,
    }
    if (editingBlock) {
      await updateMut.mutateAsync({ id: editingBlock.id, fields: payload })
    } else {
      await createMut.mutateAsync({
        projectId,
        shootDayId,
        ...payload,
      })
    }
    onClose()
  }

  async function remove() {
    if (!editingBlock) return
    if (!confirm('Delete this block?')) return
    await deleteMut.mutateAsync(editingBlock.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title={editingBlock ? 'Edit Block' : 'Add Block'} onClose={onClose} />
      <SheetBody className="pb-4">
        <div className="flex flex-col gap-4">
          {/* Kind */}
          <div>
            <label className="font-mono uppercase tracking-wider text-[10px] text-white/50">Type</label>
            <select
              value={form.kind}
              onChange={e => patch('kind', e.target.value as ScheduleBlockKind)}
              className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
            >
              {(Object.keys(KIND_LABEL) as ScheduleBlockKind[]).map(k => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>

          {/* Track (work kind only) */}
          {!isFullWidth && (
            <div>
              <label className="font-mono uppercase tracking-wider text-[10px] text-white/50">Track</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(['main', 'secondary', 'tertiary'] as ScheduleBlockTrack[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => patch('track', t)}
                    className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                      form.track === t
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
                    {TRACK_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono uppercase tracking-wider text-[10px] text-white/50">Start</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => patch('startTime', e.target.value)}
                className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="font-mono uppercase tracking-wider text-[10px] text-white/50">End</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => patch('endTime', e.target.value)}
                className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="font-mono uppercase tracking-wider text-[10px] text-white/50">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => patch('description', e.target.value)}
              placeholder="Shoot Office — 2m Coverage"
              className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>

          {/* Custom label */}
          {form.kind === 'custom' && (
            <div>
              <label className="font-mono uppercase tracking-wider text-[10px] text-white/50">Custom Label</label>
              <input
                type="text"
                value={form.customLabel}
                onChange={e => patch('customLabel', e.target.value)}
                placeholder="e.g. SAFETY MEETING"
                className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </div>
          )}

          {/* Location (work + side tracks) */}
          {!isFullWidth && (
            <div>
              <label className="font-mono uppercase tracking-wider text-[10px] text-white/50">Location</label>
              <select
                value={form.locationId}
                onChange={e => patch('locationId', e.target.value)}
                className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
              >
                <option value="">— None —</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Talent multi-select */}
          {(!isFullWidth || form.kind === 'talent_call') && (
            <div>
              <label className="font-mono uppercase tracking-wider text-[10px] text-white/50">Talent</label>
              {talent.length === 0 ? (
                <p className="mt-1.5 text-xs text-white/40">No talent on this project yet.</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {talent.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => patch('talentIds', toggleId(form.talentIds, t.id))}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        form.talentIds.includes(t.id)
                          ? 'bg-white/20 border-white/30 text-white'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              disabled={saving || (form.kind === 'work' && !form.description.trim())}
              className="flex-1 bg-white text-black rounded-xl py-3 font-medium disabled:opacity-40"
            >
              {editingBlock ? 'Save changes' : 'Add block'}
            </button>
            {editingBlock && (
              <button
                onClick={remove}
                disabled={deleteMut.isPending}
                className="px-5 bg-red-500/15 text-red-300 rounded-xl py-3 border border-red-500/30 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </SheetBody>
    </Sheet>
  )
}
