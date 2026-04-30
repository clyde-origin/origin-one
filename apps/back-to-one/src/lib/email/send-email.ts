// Resend adapter via fetch — no SDK dependency.
// Without RESEND_API_KEY, the stub path logs to console and returns ok.

export type SendEmailArgs = {
  to: string
  replyTo?: string | null
  subject: string
  html: string
  text?: string
}

export type SendResult =
  | { provider: 'resend' | 'stub'; ok: true; externalId: string | null }
  | { provider: 'resend' | 'stub'; ok: false; error: string }

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'no-reply@back-to-one.app'

export async function sendEmail(args: SendEmailArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[email:stub]', {
      to: args.to,
      replyTo: args.replyTo,
      subject: args.subject,
      htmlPreview: args.html.slice(0, 200) + (args.html.length > 200 ? '…' : ''),
    })
    return { provider: 'stub', ok: true, externalId: null }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [args.to],
        reply_to: args.replyTo || undefined,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { provider: 'resend', ok: false, error: data?.message ?? `HTTP ${res.status}` }
    }
    return { provider: 'resend', ok: true, externalId: data?.id ?? null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return { provider: 'resend', ok: false, error: message }
  }
}
