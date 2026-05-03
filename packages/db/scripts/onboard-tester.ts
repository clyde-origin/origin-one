// One-off: hand-onboard an external producer with a private team and
// cloned copies of the 6 seed demos.
//
// Usage:
//   pnpm --filter @origin-one/db exec tsx scripts/onboard-tester.ts \
//     --name="Luke Young" --email=luke@lukeyoungs.com --team-name="Lux Motion Picture"
//
// What it does:
//   1. Creates the new Team and the new producer User.
//   2. Clones the 3 founders (Clyde/Tyler/Kelly) into namespaced User rows
//      (e.g. clyde.bessey+<slug>@originpoint.com), leaving the originals'
//      authed identities untouched.
//   3. Deep-clones every Project where is_demo=true into the new team.
//   4. Adds the producer as TeamMember + ProjectMember on every clone.
//
// Auth (out of scope here): create the auth.users row in Supabase Studio
// after this completes; the binding handler matches by email.
//
// See docs/superpowers/specs/2026-05-03-onboard-tester-design.md.

import { PrismaClient } from '@prisma/client'
import { cloneBudget } from '../src/clone-budget'

const prisma = new PrismaClient()

// ─── Args ────────────────────────────────────────────────────────────────────

function parseArgs(): { name: string; email: string; teamName: string } {
  const out: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-z-]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  const missing = ['name', 'email', 'team-name'].filter(k => !out[k])
  if (missing.length > 0) {
    console.error(`Missing args: ${missing.join(', ')}`)
    console.error(`Usage: --name="Full Name" --email=user@example.com --team-name="Team Name"`)
    process.exit(1)
  }
  return { name: out['name'], email: out['email'], teamName: out['team-name'] }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Build a per-team email alias for cloned founder rows.
// "Clyde Bessey" + slug "lux" → "clyde.bessey+lux@originpoint.com"
function aliasEmail(name: string, slug: string): string {
  const local = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '.')
  return `${local}+${slug}@originpoint.com`
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { name: producerName, email: producerEmail, teamName } = parseArgs()
  const teamSlug = slugify(teamName)

  console.log(`\nOnboarding tester:\n  name=${producerName}\n  email=${producerEmail}\n  team="${teamName}" (slug=${teamSlug})\n`)

  // ── Pre-flight ────────────────────────────────────────────────────────────
  const existingUser = await prisma.user.findUnique({ where: { email: producerEmail } })
  if (existingUser) {
    throw new Error(`User with email ${producerEmail} already exists (id=${existingUser.id}). Aborting.`)
  }
  const existingTeam = await prisma.team.findFirst({ where: { name: teamName } })
  if (existingTeam) {
    throw new Error(`Team "${teamName}" already exists (id=${existingTeam.id}). Aborting.`)
  }

  const FOUNDERS = ['Clyde Bessey', 'Tyler Heckerman', 'Kelly Pratt'] as const
  const foundersOriginal = await prisma.user.findMany({ where: { name: { in: [...FOUNDERS] } } })
  if (foundersOriginal.length !== FOUNDERS.length) {
    throw new Error(`Expected ${FOUNDERS.length} founder Users, found ${foundersOriginal.length}`)
  }
  for (const founder of foundersOriginal) {
    const aliasTaken = await prisma.user.findUnique({ where: { email: aliasEmail(founder.name, teamSlug) } })
    if (aliasTaken) {
      throw new Error(`Alias email ${aliasEmail(founder.name, teamSlug)} already exists. Aborting.`)
    }
  }

  const sourceProjects = await prisma.project.findMany({
    where: { is_demo: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, teamId: true },
  })
  if (sourceProjects.length !== 6) {
    throw new Error(`Expected 6 demo projects, found ${sourceProjects.length}`)
  }
  const sourceTeamIds = new Set(sourceProjects.map(p => p.teamId))
  if (sourceTeamIds.size !== 1) {
    throw new Error(`Demo projects span multiple teams: ${Array.from(sourceTeamIds).join(', ')}`)
  }

  console.log(`Pre-flight ok. Cloning ${sourceProjects.length} demo projects:`)
  for (const p of sourceProjects) console.log(`  - ${p.name}`)

  // ── Per-project clone (NOT in a single transaction — Prisma's interactive
  // tx default is 5s and even bumped this would risk hitting the pooler's
  // statement-timeout. Each project clones in its own scoped transaction so
  // a mid-run failure leaves a partial-but-consistent set, which the script
  // re-run can finish. Pre-flight already proved nothing collides.)

  // 1. Team + producer User + 3 founder aliases (single tx — fast and atomic).
  const seedResult = await prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: { name: teamName } })
    const producer = await tx.user.create({
      data: { email: producerEmail, name: producerName },
    })
    await tx.teamMember.create({
      data: { teamId: team.id, userId: producer.id, role: 'producer' },
    })

    const founderAliasByOriginalId = new Map<string, string>()
    for (const orig of foundersOriginal) {
      const alias = await tx.user.create({
        data: {
          email: aliasEmail(orig.name, teamSlug),
          name: orig.name,
          avatarUrl: orig.avatarUrl,
          phone: orig.phone,
        },
      })
      founderAliasByOriginalId.set(orig.id, alias.id)
    }
    return { team, producer, founderAliasByOriginalId }
  })

  console.log(`\nCreated team ${seedResult.team.id}, producer ${seedResult.producer.id}, 3 founder aliases.\n`)

  for (const sp of sourceProjects) {
    console.log(`Cloning "${sp.name}"…`)
    await cloneProjectInto(
      sp.id,
      seedResult.team.id,
      seedResult.producer.id,
      seedResult.founderAliasByOriginalId,
    )
    console.log(`  done.`)
  }

  console.log(`\nAll 6 demos cloned into team "${teamName}".`)
  console.log(`\nNext: Supabase Studio → Authentication → Users → Add user`)
  console.log(`        email=${producerEmail} password=<provided separately>`)
  console.log(`      The binding handler matches by email on first sign-in.`)
}

// ─── Per-project clone ───────────────────────────────────────────────────────

async function cloneProjectInto(
  sourceProjectId: string,
  targetTeamId: string,
  producerUserId: string,
  founderAliasByOriginalId: Map<string, string>,
): Promise<string> {
  // userIdMap re-targets userIds during the clone:
  //   - founders → cloned aliases (so real authed founders never gain RLS
  //     access to this team via ProjectMember)
  //   - everyone else → unchanged (passive seed Users, no authId)
  const userIdMap = (originalId: string): string =>
    founderAliasByOriginalId.get(originalId) ?? originalId

  return prisma.$transaction(async (tx) => {
    const src = await tx.project.findUniqueOrThrow({
      where: { id: sourceProjectId },
      include: {
        scenes:           { include: { shots: true }, orderBy: { sortOrder: 'asc' } },
        entities:         true,
        documents:        true,
        milestones:       { include: { people: true } },
        actionItems:      true,
        moodboardTabs:    { orderBy: { sortOrder: 'asc' } },
        moodboardRefs:    { orderBy: { sortOrder: 'asc' } },
        locations:        { orderBy: { sortOrder: 'asc' } },
        propSourced:      true,
        wardrobeSourced:  true,
        talents:          { include: { assignments: true } },
        workflowNodes:    { orderBy: { sortOrder: 'asc' } },
        workflowEdges:    true,
        deliverables:     { orderBy: { sortOrder: 'asc' } },
        shootDays:        { orderBy: { sortOrder: 'asc' } },
        inventoryItems:   { orderBy: { sortOrder: 'asc' } },
        members:          true,
        budget:           { select: { id: true } },
      },
    })

    // 1. Project shell.
    const tgt = await tx.project.create({
      data: {
        teamId: targetTeamId,
        name: src.name,
        status: src.status,
        color: src.color,
        client: src.client,
        type: src.type,
        aspectRatio: src.aspectRatio,
        is_demo: true,
      },
    })

    // 2. ProjectMember (every original member, plus producer).
    // Skip defaultLineItemId — re-mapping requires Budget to be cloned first;
    // demo experience unaffected (Q2 hybrid pre-fill is a UX nice-to-have).
    for (const m of src.members) {
      await tx.projectMember.create({
        data: {
          projectId: tgt.id,
          userId: userIdMap(m.userId),
          role: m.role,
          department: m.department,
          notes: m.notes,
          skills: m.skills,
          canEdit: m.canEdit,
        },
      })
    }
    // Producer as a member if not already covered (they are not in source members).
    await tx.projectMember.upsert({
      where: { projectId_userId_role: { projectId: tgt.id, userId: producerUserId, role: 'producer' } },
      update: {},
      create: {
        projectId: tgt.id,
        userId: producerUserId,
        role: 'producer',
        department: 'Production',
        canEdit: true,
      },
    })

    // 3. Entities — id-mapped because many tables reference Entity.id.
    const entityIdMap = new Map<string, string>()
    for (const e of src.entities) {
      const created = await tx.entity.create({
        data: {
          projectId: tgt.id,
          type: e.type,
          name: e.name,
          description: e.description,
          metadata: e.metadata as object | undefined ?? undefined,
        },
      })
      entityIdMap.set(e.id, created.id)
    }

    // 4. Locations (entityId re-mapped). id-mapped — ShootDay references it.
    const locationIdMap = new Map<string, string>()
    for (const l of src.locations) {
      const created = await tx.location.create({
        data: {
          projectId: tgt.id,
          entityId: l.entityId ? entityIdMap.get(l.entityId) ?? null : null,
          name: l.name,
          description: l.description,
          address: l.address,
          keyContact: l.keyContact,
          webLink: l.webLink,
          shootDates: l.shootDates,
          status: l.status,
          approved: l.approved,
          notes: l.notes,
          sceneTab: l.sceneTab,
          sortOrder: l.sortOrder,
        },
      })
      locationIdMap.set(l.id, created.id)
    }

    // 5. Scenes + Shots.
    for (const sc of src.scenes) {
      const newScene = await tx.scene.create({
        data: {
          projectId: tgt.id,
          sceneNumber: sc.sceneNumber,
          title: sc.title,
          description: sc.description,
          sortOrder: sc.sortOrder,
        },
      })
      if (sc.shots.length > 0) {
        await tx.shot.createMany({
          data: sc.shots.map(s => ({
            sceneId: newScene.id,
            shotNumber: s.shotNumber,
            size: s.size,
            description: s.description,
            imageUrl: s.imageUrl,
            notes: s.notes,
            shootOrder: s.shootOrder,
            status: s.status,
            sortOrder: s.sortOrder,
          })),
        })
      }
    }

    // 6. Documents — createdBy re-mapped (founders → aliases).
    for (const d of src.documents) {
      await tx.document.create({
        data: {
          projectId: tgt.id,
          type: d.type,
          title: d.title,
          content: d.content,
          version: d.version,
          createdBy: userIdMap(d.createdBy),
        },
      })
    }

    // 7. Milestones + MilestonePerson.
    for (const ms of src.milestones) {
      const created = await tx.milestone.create({
        data: {
          projectId: tgt.id,
          title: ms.title,
          date: ms.date,
          status: ms.status,
          notes: ms.notes,
          mentions: ms.mentions,
        },
      })
      if (ms.people.length > 0) {
        await tx.milestonePerson.createMany({
          data: ms.people.map(p => ({
            milestoneId: created.id,
            userId: userIdMap(p.userId),
          })),
        })
      }
    }

    // 8. ActionItems (assignedTo re-mapped).
    for (const a of src.actionItems) {
      await tx.actionItem.create({
        data: {
          projectId: tgt.id,
          title: a.title,
          description: a.description,
          status: a.status,
          assignedTo: a.assignedTo ? userIdMap(a.assignedTo) : null,
          department: a.department,
          dueDate: a.dueDate,
          mentions: a.mentions,
        },
      })
    }

    // 9. Moodboard — tabs id-mapped, refs reference tabId.
    const moodTabIdMap = new Map<string, string>()
    for (const t of src.moodboardTabs) {
      const created = await tx.moodboardTab.create({
        data: { projectId: tgt.id, name: t.name, sortOrder: t.sortOrder },
      })
      moodTabIdMap.set(t.id, created.id)
    }
    for (const r of src.moodboardRefs) {
      await tx.moodboardRef.create({
        data: {
          projectId: tgt.id,
          cat: r.cat,
          title: r.title,
          note: r.note,
          imageUrl: r.imageUrl,
          gradient: r.gradient,
          sortOrder: r.sortOrder,
          tabId: r.tabId ? moodTabIdMap.get(r.tabId) ?? null : null,
        },
      })
    }

    // 10. Talents + TalentAssignment (entityId re-mapped via entityIdMap).
    const talentIdMap = new Map<string, string>()
    for (const t of src.talents) {
      const created = await tx.talent.create({
        data: {
          projectId: tgt.id,
          name: t.name,
          role: t.role,
          agency: t.agency,
          contact: t.contact,
          email: t.email,
          phone: t.phone,
          dietaryRestrictions: t.dietaryRestrictions,
          repName: t.repName,
          repEmail: t.repEmail,
          repPhone: t.repPhone,
          shootDates: t.shootDates as object | undefined ?? undefined,
          notes: t.notes,
          imageUrl: t.imageUrl,
        },
      })
      talentIdMap.set(t.id, created.id)
      if (t.assignments.length > 0) {
        await tx.talentAssignment.createMany({
          data: t.assignments.flatMap(a => {
            const newEntityId = entityIdMap.get(a.entityId)
            return newEntityId ? [{ talentId: created.id, entityId: newEntityId }] : []
          }),
        })
      }
    }

    // 11. PropSourced + WardrobeSourced (entityId re-mapped).
    for (const p of src.propSourced) {
      await tx.propSourced.create({
        data: {
          projectId: tgt.id,
          entityId: p.entityId ? entityIdMap.get(p.entityId) ?? null : null,
          status: p.status,
          isHero: p.isHero,
        },
      })
    }
    for (const w of src.wardrobeSourced) {
      await tx.wardrobeSourced.create({
        data: {
          projectId: tgt.id,
          entityId: w.entityId ? entityIdMap.get(w.entityId) ?? null : null,
          status: w.status,
        },
      })
    }

    // 12. WorkflowNodes + WorkflowEdges (assignee/source/target re-mapped).
    const wfNodeIdMap = new Map<string, string>()
    for (const n of src.workflowNodes) {
      const created = await tx.workflowNode.create({
        data: {
          projectId: tgt.id,
          label: n.label,
          type: n.type,
          software: n.software,
          notes: n.notes,
          assigneeId: n.assigneeId ? userIdMap(n.assigneeId) : null,
          sortOrder: n.sortOrder,
        },
      })
      wfNodeIdMap.set(n.id, created.id)
    }
    for (const e of src.workflowEdges) {
      const newSource = wfNodeIdMap.get(e.sourceId)
      const newTarget = wfNodeIdMap.get(e.targetId)
      if (!newSource || !newTarget) continue
      await tx.workflowEdge.create({
        data: {
          projectId: tgt.id,
          sourceId: newSource,
          targetId: newTarget,
          format: e.format,
          inputFormat: e.inputFormat,
          outputFormat: e.outputFormat,
          handoff: e.handoff,
          notes: e.notes,
        },
      })
    }

    // 13. Deliverables.
    if (src.deliverables.length > 0) {
      await tx.deliverable.createMany({
        data: src.deliverables.map(d => ({
          projectId: tgt.id,
          title: d.title,
          length: d.length,
          format: d.format,
          aspectRatio: d.aspectRatio,
          resolution: d.resolution,
          colorSpace: d.colorSpace,
          soundSpecs: d.soundSpecs,
          notes: d.notes,
          sortOrder: d.sortOrder,
        })),
      })
    }

    // 14. ShootDays (locationId re-mapped).
    for (const sd of src.shootDays) {
      await tx.shootDay.create({
        data: {
          projectId: tgt.id,
          date: sd.date,
          type: sd.type,
          notes: sd.notes,
          mentions: sd.mentions,
          locationId: sd.locationId ? locationIdMap.get(sd.locationId) ?? null : null,
          sortOrder: sd.sortOrder,
        },
      })
    }

    // 15. InventoryItem — assigneeId is ProjectMember.id, not User.id.
    // We need a mapping from source ProjectMember.id → target ProjectMember.id.
    // Build it from (userId, role) pairs.
    if (src.inventoryItems.some(i => i.assigneeId)) {
      const tgtMembers = await tx.projectMember.findMany({
        where: { projectId: tgt.id },
        select: { id: true, userId: true, role: true },
      })
      const memberKey = (userId: string, role: string) => `${userId}|${role}`
      const memberByKey = new Map(tgtMembers.map(m => [memberKey(m.userId, m.role), m.id]))
      const sourceMembersById = new Map(src.members.map(m => [m.id, m]))
      const memberIdMap = (sourceMemberId: string): string | null => {
        const s = sourceMembersById.get(sourceMemberId)
        if (!s) return null
        const newUserId = userIdMap(s.userId)
        return memberByKey.get(memberKey(newUserId, s.role)) ?? null
      }
      for (const i of src.inventoryItems) {
        await tx.inventoryItem.create({
          data: {
            projectId: tgt.id,
            name: i.name,
            quantity: i.quantity,
            description: i.description,
            department: i.department,
            status: i.status,
            source: i.source,
            notes: i.notes,
            importSource: i.importSource,
            assigneeId: i.assigneeId ? memberIdMap(i.assigneeId) : null,
            sortOrder: i.sortOrder,
          },
        })
      }
    } else if (src.inventoryItems.length > 0) {
      await tx.inventoryItem.createMany({
        data: src.inventoryItems.map(i => ({
          projectId: tgt.id,
          name: i.name,
          quantity: i.quantity,
          description: i.description,
          department: i.department,
          status: i.status,
          source: i.source,
          notes: i.notes,
          importSource: i.importSource,
          sortOrder: i.sortOrder,
        })),
      })
    }

    return tgt.id
  }, { timeout: 120_000 }).then(async (newProjectId) => {
    // 16. Budget — clone outside the per-project tx so cloneBudget can use its
    // own internal $transaction (Prisma doesn't nest interactive txs).
    if (sourceProjectId) {
      const hasBudget = await prisma.budget.findUnique({
        where: { projectId: sourceProjectId },
        select: { id: true },
      })
      if (hasBudget) {
        await cloneBudget(prisma, sourceProjectId, newProjectId)
      }
    }
    return newProjectId
  })
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('\nFAILED:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
