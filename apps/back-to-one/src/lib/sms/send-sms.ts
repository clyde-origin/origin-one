// Twilio adapter via fetch — no SDK dependency.
// Without TWILIO_* env vars, the stub path logs to console and returns ok.

export type SendSmsArgs = {
  to: string
  body: string
}

export type SendSmsResult =
  | { provider: 'twilio' | 'stub'; ok: true; externalId: string | null }
  | { provider: 'twilio' | 'stub'; ok: false; error: string }

export async function sendSms(args: SendSmsArgs): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    console.log('[sms:stub]', { to: args.to, body: args.body })
    return { provider: 'stub', ok: true, externalId: null }
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64')
    const params = new URLSearchParams({ From: from, To: args.to, Body: args.body })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) {
      return { provider: 'twilio', ok: false, error: (data?.message as string) ?? `HTTP ${res.status}` }
    }
    return { provider: 'twilio', ok: true, externalId: (data?.sid as string) ?? null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return { provider: 'twilio', ok: false, error: message }
  }
}
