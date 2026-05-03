// Hand-bind a User.authId after Supabase Studio created the auth.users row.
//
// Why: /login's password flow never visits /auth/callback, so the binding
// handler doesn't run on password sign-in. RLS gates by User.authId, so an
// unbound row results in an empty /projects page.
//
// Usage:
//   pnpm --filter @origin-one/db exec tsx scripts/bind-tester.ts \
//     --email=luke@lukeyoungs.com --auth-id=<auth_users.id from Studio>

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function parseArgs(): { email: string; authId: string } {
  const out: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-z-]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  const missing = ['email', 'auth-id'].filter(k => !out[k])
  if (missing.length > 0) {
    console.error(`Missing args: ${missing.join(', ')}`)
    console.error(`Usage: --email=user@example.com --auth-id=<uuid>`)
    process.exit(1)
  }
  return { email: out['email'], authId: out['auth-id'] }
}

async function main() {
  const { email, authId } = parseArgs()

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, authId: true },
  })
  if (!user) throw new Error(`No User row found for email ${email}`)

  if (user.authId === authId) {
    console.log(`Already bound: ${user.name} (${email}) → authId ${authId}`)
    return
  }
  if (user.authId && user.authId !== authId) {
    throw new Error(`User.authId already set to ${user.authId}; refusing to overwrite with ${authId}`)
  }

  // Guard: target authId must not collide with another User row.
  const collision = await prisma.user.findUnique({
    where: { authId },
    select: { id: true, email: true },
  })
  if (collision) {
    throw new Error(`authId ${authId} is already on User ${collision.email} (${collision.id})`)
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { authId },
    select: { id: true, name: true, email: true, authId: true },
  })

  console.log(`Bound: ${updated.name} (${updated.email}) → authId ${updated.authId}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error('FAILED:', e); return prisma.$disconnect().then(() => process.exit(1)) })
