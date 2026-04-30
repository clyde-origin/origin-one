// Inline HTML email template for call sheets — no react-email dependency.
// Returns { html, text } pair. Tracking pixel + confirm/decline links use
// the recipient's confirmToken.

import { formatTime } from '@/lib/schedule/format-time'

export type CallSheetEmailData = {
  recipientName: string
  projectTitle: string
  shootDateLabel: string         // "Tue, Jul 22, 2025"
  callTime: string | null        // 'HH:MM' 24h
  setAddress: string | null
  productionNotes: string | null
  parkingNotes: string | null
  appUrl: string                 // base URL
  confirmToken: string           // for confirm + pixel + view links
  replyTo: string | null
}

export function buildCallSheetEmail(d: CallSheetEmailData): { subject: string; html: string; text: string } {
  const callDisplay = d.callTime ? formatTime(d.callTime) : '—'
  const subject = `Call Sheet for "${d.projectTitle}" — ${d.shootDateLabel} @ ${callDisplay}`
  const confirmUrl = `${d.appUrl}/c/${d.confirmToken}`
  const viewUrl = `${d.appUrl}/c/${d.confirmToken}/view`
  const pixelUrl = `${d.appUrl}/c/${d.confirmToken}/pixel.gif`

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;background:#f5f5f7;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;">
    <p style="margin:0 0 4px;font-size:13px;color:#666;">Hi ${escapeHtml(d.recipientName)},</p>
    <h1 style="margin:8px 0 4px;font-size:20px;color:#000;">${escapeHtml(d.projectTitle)}</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#444;">${escapeHtml(d.shootDateLabel)}</p>

    <div style="text-align:center;padding:20px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;">Your Call Time</p>
      <p style="margin:0;font-size:32px;font-weight:300;color:#000;">${escapeHtml(callDisplay)}</p>
    </div>

    <div style="text-align:center;margin:24px 0 12px;">
      <a href="${confirmUrl}" style="background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:500;font-size:14px;">Confirm or Decline</a>
    </div>
    <p style="margin:0 0 24px;text-align:center;font-size:12px;">
      <a href="${viewUrl}" style="color:#666;text-decoration:underline;">See full call sheet</a>
    </p>

    ${d.setAddress ? `
    <div style="margin-bottom:18px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;">Set Location</p>
      <p style="margin:0;font-size:14px;color:#000;white-space:pre-line;">${escapeHtml(d.setAddress)}</p>
    </div>` : ''}

    ${d.productionNotes ? `
    <div style="margin-bottom:18px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;">Production Notes</p>
      <p style="margin:0;font-size:13px;color:#444;white-space:pre-line;line-height:1.5;">${escapeHtml(d.productionNotes)}</p>
    </div>` : ''}

    ${d.parkingNotes ? `
    <div style="margin-bottom:18px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;">Parking</p>
      <p style="margin:0;font-size:13px;color:#444;white-space:pre-line;line-height:1.5;">${escapeHtml(d.parkingNotes)}</p>
    </div>` : ''}

    <p style="margin-top:32px;font-size:11px;color:#999;text-align:center;">
      Questions? ${d.replyTo ? `Reply to this email or contact <a href="mailto:${escapeHtml(d.replyTo)}" style="color:#666;">${escapeHtml(d.replyTo)}</a>.` : 'Reply to this email.'}
    </p>
    <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;border:0;" />
  </div>
</body></html>`

  const text = [
    `Hi ${d.recipientName},`,
    ``,
    `${d.projectTitle}`,
    `${d.shootDateLabel}`,
    ``,
    `Your call time: ${callDisplay}`,
    d.setAddress ? `Location: ${d.setAddress}` : '',
    ``,
    `Confirm or Decline: ${confirmUrl}`,
    `Full call sheet: ${viewUrl}`,
    ``,
    d.productionNotes ? `Production notes:\n${d.productionNotes}` : '',
    d.parkingNotes ? `\nParking:\n${d.parkingNotes}` : '',
  ].filter(Boolean).join('\n')

  return { subject, html, text }
}

export function buildCallSheetSms(d: {
  recipientName: string
  projectTitle: string
  shootDateLabel: string
  callTime: string | null
  setAddress: string | null
  appUrl: string
  confirmToken: string
}): string {
  const call = d.callTime ? formatTime(d.callTime) : '—'
  const viewUrl = `${d.appUrl}/c/${d.confirmToken}/view`
  const lines = [
    `${d.projectTitle}`,
    `${d.shootDateLabel}`,
    `Your call: ${call}`,
  ]
  if (d.setAddress) lines.push(`Location: ${d.setAddress.split('\n')[0]}`)
  lines.push(`Confirm: ${viewUrl}`)
  return lines.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
