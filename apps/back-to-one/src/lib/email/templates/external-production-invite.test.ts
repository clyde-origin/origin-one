import { describe, it, expect } from 'vitest'
import { renderInviteEmail } from './external-production-invite'

describe('renderInviteEmail', () => {
  const baseArgs = {
    producerName: 'Chris Loanzon',
    productionName: 'THNK Elephant',
    magicLink: 'https://app.example.com/auth/callback?token=xyz',
    heroImageUrl: 'https://app.example.com/images/b21_bg.jpg',
  }

  it('includes the magic link as the primary CTA href', () => {
    const { html } = renderInviteEmail(baseArgs)
    expect(html).toContain(`href="${baseArgs.magicLink}"`)
  })

  it('addresses the producer by name', () => {
    const { html, text } = renderInviteEmail(baseArgs)
    expect(html).toContain('Chris Loanzon')
    expect(text).toContain('Chris Loanzon')
  })

  it('mentions the production name in the subject and body', () => {
    const result = renderInviteEmail(baseArgs)
    expect(result.subject).toContain('THNK Elephant')
    expect(result.html).toContain('THNK Elephant')
  })

  it('uses the hero image absolute URL', () => {
    const { html } = renderInviteEmail(baseArgs)
    expect(html).toContain(`src="${baseArgs.heroImageUrl}"`)
  })

  it('returns a plaintext fallback', () => {
    const { text } = renderInviteEmail(baseArgs)
    expect(text).toContain('Chris Loanzon')
    expect(text).toContain('THNK Elephant')
    expect(text).toContain(baseArgs.magicLink)
  })

  it('html-escapes name and production fields', () => {
    const args = { ...baseArgs, producerName: 'O\'Brien <hi>', productionName: 'A&B' }
    const { html } = renderInviteEmail(args)
    expect(html).toContain('O&#39;Brien &lt;hi&gt;')
    expect(html).toContain('A&amp;B')
  })
})
