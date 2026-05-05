export type InviteEmailArgs = {
  producerName: string
  productionName: string
  magicLink: string
  heroImageUrl: string
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderInviteEmail(args: InviteEmailArgs): RenderedEmail {
  const name = escapeHtml(args.producerName)
  const prod = escapeHtml(args.productionName)
  const link = args.magicLink            // already a URL, never escape
  const hero = args.heroImageUrl

  const subject = `Welcome to ${args.productionName} on Back to One`

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#04040a;color:#e8e8ea;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Geist,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#04040a;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#0a0a14;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="position:relative;padding:0;">
                <img src="${hero}" width="560" height="240" alt="" style="display:block;width:100%;height:240px;object-fit:cover;border-top-left-radius:20px;border-top-right-radius:20px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;color:#e8e8ea;line-height:1.25;">Welcome, ${name}</h1>
                <p style="margin:0;font-size:16px;line-height:1.55;color:#bdbdc6;">You've been added as a producer on <strong style="color:#e8e8ea;">${prod}</strong> in Back to One — Origin Point's production operating system.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;">
                <a href="${link}" style="display:inline-block;background:#6470f3;color:#04040a;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:14px;">Sign in to Back to One</a>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#7c7c8a;">This link signs you in directly — no password needed. It expires in 24 hours. If the button doesn't work, copy and paste this URL into your browser:</p>
                <p style="margin:8px 0 0;font-size:12px;word-break:break-all;color:#5d5d6a;"><a href="${link}" style="color:#5d5d6a;text-decoration:underline;">${link}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;border-top:1px solid rgba(255,255,255,0.05);">
                <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#5d5d6a;">If you weren't expecting this invite, you can safely ignore the email — nothing happens until you click the link.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = `Welcome, ${args.producerName}

You've been added as a producer on ${args.productionName} in Back to One.

Sign in here (link expires in 24h):
${args.magicLink}

If you weren't expecting this, ignore this email.`

  return { subject, html, text }
}
