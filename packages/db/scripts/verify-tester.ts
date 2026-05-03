// Spot-check the most recent tester onboard. Run after onboard-tester.ts.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const team = await prisma.team.findFirst({ where: { name: 'Lux Motion Picture' } })
  if (!team) { console.log('Team not found.'); return }

  const projects = await prisma.project.findMany({
    where: { teamId: team.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, name: true, is_demo: true,
      _count: {
        select: {
          scenes: true, entities: true, locations: true,
          milestones: true, actionItems: true, members: true,
          talents: true, workflowNodes: true, deliverables: true,
          shootDays: true, propSourced: true, wardrobeSourced: true,
          inventoryItems: true, moodboardTabs: true,
        },
      },
      budget: { select: { id: true } },
    },
  })

  console.log(`Team: ${team.name} (${team.id})`)
  console.log(`Projects: ${projects.length}`)
  for (const p of projects) {
    const c = p._count
    console.log(
      `  ${p.name}` +
      `  is_demo=${p.is_demo}` +
      `  scenes=${c.scenes} ents=${c.entities} loc=${c.locations}` +
      `  ms=${c.milestones} ai=${c.actionItems} mem=${c.members}` +
      `  tal=${c.talents} wf=${c.workflowNodes} del=${c.deliverables}` +
      `  sd=${c.shootDays} ps=${c.propSourced} ws=${c.wardrobeSourced}` +
      `  inv=${c.inventoryItems} mb=${c.moodboardTabs}` +
      `  budget=${p.budget ? 'yes' : 'no'}`
    )
  }

  const luke = await prisma.user.findUnique({
    where: { email: 'luke@lukeyoungs.com' },
    select: { id: true, name: true, authId: true },
  })
  console.log(`\nProducer: ${luke?.name} authId=${luke?.authId ?? 'null (not yet bound)'}`)

  const lukeMemberships = await prisma.projectMember.count({
    where: { userId: luke!.id, project: { teamId: team.id } },
  })
  console.log(`Luke is ProjectMember on ${lukeMemberships} of ${projects.length} cloned projects.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)) })
