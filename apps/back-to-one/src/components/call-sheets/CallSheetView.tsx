'use client'

import { formatTime, formatTimeRange } from '@/lib/schedule/format-time'
import type { CallSheetViewModel } from '@/lib/call-sheet/derive-view-model'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${DOW[date.getUTCDay()]}, ${SHORT_MONTH[date.getUTCMonth()]} ${d}, ${y}`
}

const TALENT_AVATAR_HUES = ['#ff8a4c', '#a78bfa', '#34d399', '#f472b6', '#60a5fa', '#fbbf24']

function avatarColorFor(idx: number): string {
  return TALENT_AVATAR_HUES[idx % TALENT_AVATAR_HUES.length]
}

export function CallSheetView({ vm }: { vm: CallSheetViewModel }) {
  const cs = vm.callSheet
  const sd = vm.shootDay

  return (
    <div className="bg-white text-black mx-auto max-w-3xl rounded-2xl overflow-hidden shadow-2xl">
      {/* HEADER */}
      <div className="grid grid-cols-3 gap-6 p-6 border-b border-black/10">
        <div>
          <div className="text-3xl font-bold tracking-tight mb-3">●</div>
          <hr className="border-black/15 my-3" />
          <div className="text-sm font-semibold mb-1">{vm.project.name}</div>
          <hr className="border-black/15 my-3" />
          {vm.productionRoles.slice(0, 3).map((p, i) => (
            <div key={i} className="text-xs mt-2">
              <div className="font-semibold">{p.role}:</div>
              <div>{p.name}</div>
              {p.phone && <div className="text-black/60">{p.phone}</div>}
            </div>
          ))}
        </div>

        <div className="text-center">
          {cs.title && <h1 className="text-xl font-bold leading-tight">{cs.title}</h1>}
          {cs.subtitle && <p className="text-sm text-black/70 mt-1 italic">{cs.subtitle}</p>}
          {cs.generalCallTime && (
            <>
              <p className="text-[10px] uppercase tracking-widest mt-4 text-black/60">General Call Time</p>
              <p className="text-3xl font-light leading-none">{formatTime(cs.generalCallTime)}</p>
            </>
          )}
          {cs.productionNotes && (
            <p className="text-xs text-black/70 mt-4 whitespace-pre-line leading-relaxed">{cs.productionNotes}</p>
          )}
        </div>

        <div>
          {cs.episodeOrEvent && (
            <div className="text-[10px] uppercase tracking-widest text-black/60">{cs.episodeOrEvent}</div>
          )}
          <div className="text-sm font-semibold mt-1">{fullDate(sd.date)}</div>
          <hr className="border-black/15 my-3" />
          {(cs.weatherTempHigh != null || cs.weatherTempLow != null) && (
            <>
              <div className="text-2xl font-light">
                {cs.weatherTempHigh ?? '–'}°<span className="text-sm text-black/50"> / {cs.weatherTempLow ?? '–'}</span>
              </div>
              {cs.weatherCondition && <div className="text-xs text-black/60">{cs.weatherCondition}</div>}
            </>
          )}
          {(cs.sunriseTime || cs.sunsetTime) && (
            <div className="text-[11px] text-black/60 mt-1">
              {cs.sunriseTime && <>Sunrise {formatTime(cs.sunriseTime)}</>}
              {cs.sunriseTime && cs.sunsetTime && <> · </>}
              {cs.sunsetTime && <>Sunset {formatTime(cs.sunsetTime)}</>}
            </div>
          )}
          <hr className="border-black/15 my-3" />
          <table className="w-full text-xs">
            <tbody>
              {cs.crewCallTime && <tr><td className="font-semibold py-0.5">Crew Call</td><td className="text-right">{formatTime(cs.crewCallTime)}</td></tr>}
              {cs.shootingCallTime && <tr><td className="font-semibold py-0.5">Shooting Call</td><td className="text-right">{formatTime(cs.shootingCallTime)}</td></tr>}
              {cs.lunchTime && <tr><td className="font-semibold py-0.5">Lunch</td><td className="text-right">{formatTime(cs.lunchTime)}</td></tr>}
              {cs.estWrapTime && <tr><td className="font-semibold py-0.5">Est. Wrap</td><td className="text-right">{formatTime(cs.estWrapTime)}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOCATIONS */}
      <div className="px-6 py-5 border-b border-black/10">
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3">📍 Locations</h2>
        <div className="grid grid-cols-3 gap-6 text-xs">
          <div>
            <div className="font-semibold uppercase tracking-wider text-[10px] mb-2 border-b border-black/20 pb-1">Set Location</div>
            {sd.locationName && <div className="font-semibold">{sd.locationName}</div>}
            {sd.locationAddress ? (
              <div className="text-black/70 whitespace-pre-line">{sd.locationAddress}</div>
            ) : sd.locationName ? null : (
              <div className="text-black/40 italic">No location set on this shoot day</div>
            )}
          </div>
          <div>
            <div className="font-semibold uppercase tracking-wider text-[10px] mb-2 border-b border-black/20 pb-1">Parking</div>
            {cs.parkingNotes ? (
              <div className="text-black/70 whitespace-pre-line">{cs.parkingNotes}</div>
            ) : (
              <div className="text-black/40 italic">—</div>
            )}
          </div>
          <div>
            <div className="font-semibold uppercase tracking-wider text-[10px] mb-2 border-b border-black/20 pb-1">Nearest Hospital</div>
            {cs.nearestHospitalName ? (
              <>
                <div className="font-semibold">{cs.nearestHospitalName}</div>
                {cs.nearestHospitalAddress && <div className="text-black/70 whitespace-pre-line">{cs.nearestHospitalAddress}</div>}
                {cs.nearestHospitalPhone && <div className="text-black/70">{cs.nearestHospitalPhone}</div>}
              </>
            ) : (
              <div className="text-black/40 italic">—</div>
            )}
          </div>
        </div>
      </div>

      {/* CLIENTS */}
      {vm.clientRows.length > 0 && (
        <div className="px-6 py-5 border-b border-black/10">
          <div className="flex justify-between items-baseline mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider">👥 Clients</h2>
            <span className="text-[10px] uppercase tracking-widest text-black/50">{vm.totalClientCount} Total</span>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-[10px] uppercase tracking-widest text-black/50 border-b border-black/15"><th className="text-left py-1.5 w-1/3">Name</th><th className="text-left py-1.5">Role</th><th className="text-right py-1.5">Call</th></tr></thead>
            <tbody>
              {vm.clientRows.map(c => (
                <tr key={c.id} className="border-b border-black/5"><td className="py-2 font-semibold">{c.name}</td><td className="text-black/70">{c.role}</td><td className="text-right">{formatTime(c.callTime)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TALENT */}
      {vm.talentRows.length > 0 && (
        <div className="px-6 py-5 border-b border-black/10">
          <div className="flex justify-between items-baseline mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider">🎭 Talent</h2>
            <span className="text-[10px] uppercase tracking-widest text-black/50">{vm.totalTalentCount} Total</span>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-[10px] uppercase tracking-widest text-black/50 border-b border-black/15"><th className="w-12 py-1.5">ID</th><th className="text-left py-1.5">Name</th><th className="text-left py-1.5">Role</th><th className="text-right py-1.5">Call</th><th className="text-right py-1.5">H/MU</th></tr></thead>
            <tbody>
              {vm.talentRows.map((t, idx) => (
                <tr key={t.id} className="border-b border-black/5">
                  <td className="py-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold tracking-tight" style={{ background: avatarColorFor(idx) }}>{t.initials}</div>
                  </td>
                  <td className="font-semibold">{t.name}</td>
                  <td className="text-black/70 italic">{t.role ? `"${t.role}"` : '—'}</td>
                  <td className="text-right">{formatTime(t.callTime)}</td>
                  <td className="text-right">{t.hmuTime ? formatTime(t.hmuTime) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREW */}
      {vm.totalCrewCount > 0 && (
        <div className="px-6 py-5 border-b border-black/10">
          <div className="flex justify-between items-baseline mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider">🎬 Crew</h2>
            <span className="text-[10px] uppercase tracking-widest text-black/50">{vm.totalCrewCount} Total</span>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(vm.crewRowsByDept).map(([dept, rows]) => (
                <DepartmentBlock key={dept} dept={dept} rows={rows} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SCHEDULE */}
      {cs.includeSchedule && vm.schedule.length > 0 && (
        <div className="px-6 py-5 border-b border-black/10">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2">📅 Schedule</h2>
          <table className="w-full text-[11px]">
            <thead><tr className="text-[10px] uppercase tracking-widest text-black/50 border-b border-black/15">
              <th className="text-left py-1.5 w-24">Time</th>
              <th className="text-left py-1.5">Description</th>
            </tr></thead>
            <tbody>
              {vm.schedule.map(b => (
                <tr key={b.id} className="border-b border-black/5">
                  <td className="py-1.5 font-mono">{formatTimeRange(b.startTime, b.endTime)}</td>
                  <td className="py-1.5">{b.description || (b.kind === 'custom' ? b.customLabel : b.kind.replace('_', ' ').toUpperCase())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ATTACHMENTS */}
      {cs.attachmentPaths.length > 0 && (
        <div className="px-6 py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2">📎 Attachments</h2>
          <ul className="text-xs">
            {cs.attachmentPaths.map(p => {
              const filename = p.split('/').pop() ?? p
              return <li key={p} className="text-black/70">{filename}</li>
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function DepartmentBlock({ dept, rows }: { dept: string; rows: { id: string; name: string; role: string; callTime: string }[] }) {
  return (
    <>
      <tr><td colSpan={3} className="bg-black text-white text-[10px] uppercase tracking-widest px-3 py-1.5 mt-2 font-semibold">{dept}</td></tr>
      {rows.map(r => (
        <tr key={r.id} className="border-b border-black/5">
          <td className="py-2 font-semibold">{r.name}</td>
          <td className="text-black/70">{r.role}</td>
          <td className="text-right">{formatTime(r.callTime)}</td>
        </tr>
      ))}
    </>
  )
}
