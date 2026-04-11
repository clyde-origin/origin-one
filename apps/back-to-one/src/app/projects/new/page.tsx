'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCreateProject, useAllCrew, useAddCrewMember } from '@/lib/hooks/useOriginOne'
import { CrewAvatar } from '@/components/ui'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { getProjectColor } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'
import { useKeyboardOffset } from '@/lib/hooks/useKeyboardOffset'
import type { Phase, ProjectType, CrewMember } from '@/types'

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const TYPES: ProjectType[] = ['Commercial', 'Narrative Short', 'Feature', 'Documentary', 'Branded Documentary', 'Music Video']
const PHASES: { key: Phase; label: string; color: string }[] = [
  { key: 'pre', label: 'Pre-Production', color: '#e8a020' },
  { key: 'prod', label: 'Production', color: '#6470f3' },
  { key: 'post', label: 'Post-Production', color: '#00b894' },
]

const STATUS_MAP: Record<Phase, string> = {
  pre: 'In Pre-Production',
  prod: 'In Production',
  post: 'In Post-Production',
}

export default function NewProjectPage() {
  const router = useRouter()
  const create = useCreateProject()
  const addCrew = useAddCrewMember('')

  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [type, setType] = useState<ProjectType>('Commercial')
  const [phase, setPhase] = useState<Phase>('pre')
  const [startDate, setStartDate] = useState('')
  const [shootDate, setShootDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [crewSheet, setCrewSheet] = useState(false)
  const [selectedCrew, setSelectedCrew] = useState<CrewMember[]>([])

  const keyboardOffset = useKeyboardOffset()
  const { data: allCrewData } = useAllCrew()
  const allCrew = allCrewData ?? []

  // Deduplicate crew by first+last
  const seen = new Set<string>()
  const uniqueCrew = allCrew.filter(c => {
    const key = `${c.first}-${c.last}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Group by dept
  const depts = Array.from(new Set(uniqueCrew.map(c => c.dept)))

  const toggleCrew = (member: CrewMember) => {
    const key = `${member.first}-${member.last}`
    setSelectedCrew(prev => {
      const exists = prev.find(c => `${c.first}-${c.last}` === key)
      return exists ? prev.filter(c => `${c.first}-${c.last}` !== key) : [...prev, member]
    })
  }

  const isCrewSelected = (member: CrewMember) => {
    return selectedCrew.some(c => `${c.first}-${c.last}` === `${member.first}-${member.last}`)
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    const id = genId()
    try {
      await create.mutateAsync({
        id,
        name: name.trim(),
        type,
        client: client.trim(),
        company: 'Origin Point',
        phase,
        status: STATUS_MAP[phase] as any,
        logline: '',
        runtimeTarget: null,
        aspectRatio: null,
        captureFormat: null,
        startDate: startDate || null,
        shootDate: shootDate || null,
        shootDateEnd: null,
        deliveryDate: deliveryDate || null,
        folderId: null,
        displayOrder: 0,
      })
      // Add selected crew
      for (const member of selectedCrew) {
        await addCrew.mutateAsync({
          projectId: id, first: member.first, last: member.last,
          role: member.role, dept: member.dept,
          color1: member.color1, color2: member.color2,
          createdAt: new Date().toISOString(),
        } as any)
      }
      router.push(`/projects/${id}`)
    } catch (e) {
      console.error('Failed to create project:', e)
    }
  }

  const inputClass = 'w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors'

  return (
    <div className="screen">
      {/* Topbar */}
      <div
        className="flex items-center gap-2.5 px-4 flex-shrink-0 border-b border-border"
        style={{ height: 54, paddingTop: 'var(--safe-top)', background: 'rgba(4,4,10,0.92)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', zIndex: 10 }}
      >
        <Link href="/projects" className="font-mono text-accent-soft flex items-center gap-1" style={{ fontSize: '0.54rem' }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8.5 2.5L4.5 6.5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <span className="flex-1 text-center font-semibold text-lg tracking-tight">New Project</span>
        <div style={{ width: 44 }} />
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', padding: 20, paddingBottom: keyboardOffset + 32 }}>
        <div className="flex flex-col gap-5">

          {/* Basics */}
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Project Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Project name" className={inputClass} />
          </div>
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Client</label>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder="Client name" className={inputClass} />
          </div>

          {/* Type */}
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`font-mono text-xs tracking-wide py-2.5 px-3 rounded-lg border transition-colors text-left ${
                    type === t ? 'bg-accent/15 border-accent/30 text-accent-soft' : 'bg-surface2 border-border text-muted'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Phase */}
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Phase</label>
            <div className="flex gap-2">
              {PHASES.map(p => (
                <button key={p.key} onClick={() => setPhase(p.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border transition-colors"
                  style={{
                    background: phase === p.key ? `${p.color}22` : undefined,
                    borderColor: phase === p.key ? `${p.color}55` : 'rgba(255,255,255,0.05)',
                    color: phase === p.key ? p.color : '#62627a',
                  }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  <span className="font-mono text-xs">{p.key === 'pre' ? 'Pre' : p.key === 'prod' ? 'Prod' : 'Post'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Dates <span className="text-muted/50">(optional)</span></label>
            <div className="flex flex-col gap-2">
              <div>
                <span className="font-mono text-xs text-muted block mb-1">Start</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <span className="font-mono text-xs text-muted block mb-1">Shoot</span>
                <input type="date" value={shootDate} onChange={e => setShootDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <span className="font-mono text-xs text-muted block mb-1">Delivery</span>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Crew */}
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Crew <span className="text-muted/50">(optional)</span></label>
            <button onClick={() => setCrewSheet(true)}
              className="w-full flex items-center gap-3 px-3 py-3 bg-surface2 border border-border2 rounded-lg transition-colors active:bg-surface3">
              {selectedCrew.length > 0 ? (
                <div className="flex items-center">
                  {selectedCrew.slice(0, 4).map((c, i) => (
                    <div key={i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                      <CrewAvatar first={c.first} last={c.last} color1={c.color1} color2={c.color2} size={24} />
                    </div>
                  ))}
                  {selectedCrew.length > 4 && (
                    <span className="font-mono text-xs text-muted ml-2">+{selectedCrew.length - 4}</span>
                  )}
                </div>
              ) : (
                <span className="font-mono text-xs text-muted">Add crew from past projects</span>
              )}
              {selectedCrew.length > 0 && (
                <span className="font-mono text-xs text-accent-soft ml-auto">{selectedCrew.length} selected</span>
              )}
            </button>
          </div>

          {/* Create */}
          <button onClick={() => { haptic('medium'); handleCreate() }} disabled={!name.trim() || create.isPending}
            className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-base transition-opacity disabled:opacity-40 active:opacity-80">
            {create.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>

      {/* Crew selection sheet */}
      <Sheet open={crewSheet} onClose={() => setCrewSheet(false)} maxHeight="75vh">
        <SheetHeader title="Add Crew" onClose={() => setCrewSheet(false)} />
        <SheetBody>
          {depts.map(dept => (
            <div key={dept} className="mb-4">
              <div className="font-mono text-sm text-muted tracking-widest uppercase mb-2">{dept}</div>
              <div className="flex flex-col gap-1">
                {uniqueCrew.filter(c => c.dept === dept).map(member => {
                  const selected = isCrewSelected(member)
                  return (
                    <button key={member.id} onClick={() => toggleCrew(member)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                        selected ? 'border-accent/30 bg-accent/10' : 'border-border bg-surface2'
                      }`}>
                      <CrewAvatar first={member.first} last={member.last} color1={member.color1} color2={member.color2} size={28} />
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-base text-text">{member.first} {member.last}</div>
                        <div className="font-mono text-xs text-muted">{member.role}</div>
                      </div>
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7l3 3 5-5" stroke="#6470f3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {selectedCrew.length > 0 && (
            <button onClick={() => setCrewSheet(false)}
              className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-base mt-2 active:opacity-80">
              Add {selectedCrew.length} Crew Member{selectedCrew.length !== 1 ? 's' : ''}
            </button>
          )}
        </SheetBody>
      </Sheet>
    </div>
  )
}
