// Combined: create the auth.users row via Supabase Admin API AND bind the
// existing User.authId in one step. Replaces the manual Studio + bind dance.
//
// Usage:
//   pnpm --filter @origin-one/db exec tsx scripts/provision-tester-auth.ts \
//     --email=user@example.com --password='secret'
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

function parseArgs(): { email: string; password: string } {
  const out: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-z-]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  const missing = ['email', 'password'].filter(k => !out[k])
  if (missing.length > 0) {
    console.error(`Missing args: ${missing.join(', ')}`)
    console.error(`Usage: --email=user@example.com --password='secret'`)
    process.exit(1)
  }
  return { email: out['email'], password: out['password'] }
}

async function main() {
  const { email, password } = parseArgs()

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  // Pre-flight: User row must exist (created by onboard-tester) and not be
  // already bound. Done BEFORE creating the auth row so a failed bind doesn't
  // leave a dangling auth.users.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, authId: true },
  })
  if (!user) throw new Error(`No User row for ${email}. Run onboard-tester.ts first.`)
  if (user.authId) throw new Error(`User.authId already set (${user.authId}). Use bind-tester.ts to rebind manually.`)

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Idempotency: if an auth.users row already exists for this email (e.g.
  // someone partially ran this earlier), reuse it instead of erroring.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw listErr
  const users = list.users as Array<{ id: string; email?: string }>
  const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

  let authUserId: string
  if (existing) {
    console.log(`Found existing auth.users row ${existing.id}; binding to it.`)
    authUserId = existing.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw error
    if (!data.user) throw new Error('createUser returned no user')
    console.log(`Created auth.users row ${data.user.id} for ${email}.`)
    authUserId = data.user.id
  }

  // Guard: target authId must not collide.
  const collision = await prisma.user.findUnique({
    where: { authId: authUserId },
    select: { id: true, email: true },
  })
  if (collision) {
    throw new Error(`authId ${authUserId} is already on User ${collision.email} (${collision.id})`)
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { authId: authUserId },
    select: { name: true, email: true, authId: true },
  })

  console.log(`Bound: ${updated.name} (${updated.email}) → authId ${updated.authId}`)
  console.log(`Login should now work at /login with email + password.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error('FAILED:', e); return prisma.$disconnect().then(() => process.exit(1)) })
