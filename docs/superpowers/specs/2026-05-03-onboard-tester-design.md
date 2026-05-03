# Hand-onboard external producer — design

Date: 2026-05-03
First user: Luke Young — `luke@lukeyoungs.com`, team **Lux Motion Picture**

## Why

The runbook deferred "Demo cloning on team creation" until external tester #1
(`scripts/auth-day/runbook.md` §5.3). This is that moment, but scoped to a
one-off hand-add — not a productized onboarding flow. A reusable cloner +
self-serve flow ships later if more testers come in.

## Constraints

1. New producer must see only their cloned demos. No RLS visibility into
   Origin Point's seeded projects.
2. Founders (Clyde / Tyler / Kelly) are real authed users; if their `User`
   rows appear as `ProjectMember` on the cloned demos, RLS will surface
   Lux's projects to them. Must not happen.
3. Storage buckets (moodboard, storyboard, entity-attachments) are out of
   scope for this pass. Image URLs in the clone reference original-project
   paths; image breakage is a known follow-up.

## Approach

One-off CLI script at `packages/db/scripts/onboard-tester.ts`. Invoked once
per producer; everything in a single Prisma `$transaction` so partial
failures roll back cleanly.

Inputs: `--name` and `--email` and `--team-name`.

### User-row strategy (option C from brainstorm)

- **Cloned**: Clyde Bessey, Tyler Heckerman, Kelly Pratt — copied to fresh
  `User` rows with email aliases (`clyde.bessey+lux@originpoint.com`, etc.).
  No `authId`. These are passive identities so the founders' real auth
  sessions never see Lux.
- **Shared**: every other seed crew `User` (Theo, Priya, et al.) — referenced
  by id from Lux's cloned `ProjectMember` rows. Safe because they have no
  `authId` and never will.
- **New**: Luke Young — fresh `User` row, no `authId` until he claims the
  invite. Added as `TeamMember(producer)` on Lux and `ProjectMember(producer,
  canEdit=true)` on every cloned project.

### Per-project clone scope

Cloned (so the demo browses correctly):

- Project shell with `is_demo=true` and `teamId=Lux's`
- Scene + Shot
- Entity → re-mapped id used everywhere it's referenced
- Location (re-mapped `entityId`)
- Document (`createdBy` re-mapped to the cloned Clyde)
- Milestone + MilestonePerson (re-mapped userIds)
- ActionItem (re-mapped `assignedTo`)
- MoodboardTab + MoodboardRef (re-mapped `tabId`)
- Talent + TalentAssignment (re-mapped both ids)
- PropSourced + WardrobeSourced (re-mapped `entityId`)
- WorkflowNode + WorkflowEdge (re-mapped source/target/assignee)
- Deliverable
- ShootDay (re-mapped `locationId`)
- ProjectMember (every original member with userId re-mapped; plus Luke as
  producer)
- InventoryItem (re-mapped `assigneeId` via the ProjectMember map)
- Budget — via existing `cloneBudget` helper

Skipped (start empty; not part of the demo's first impression):

- Thread / ThreadMessage / ThreadRead — user activity, complex re-mapping
- ChatChannel / ChatMessage — user activity
- CrewTimecard / Expense — actuals, like cloneBudget
- Notification / PushSubscription — user activity
- EntityAttachment — storage-bound (see follow-up)
- Folder / Resource — empty in seed for most projects
- ShotlistVersion — snapshot table; recreated on demand
- UserProjectFolder / UserProjectPlacement — per-user UI state

Field-level skips:

- `ProjectMember.defaultLineItemId` — would require a second pass after
  Budget is cloned. Demo experience unaffected; UX nice-to-have.

### Auth side

Out of script. After it runs, in Supabase Studio → Authentication → Users:
create user with email `luke@lukeyoungs.com` and password `origin`. The
binding handler (auth-006) matches by email on first sign-in and populates
`User.authId`.

## Smoke test (after run)

1. Sign in as Luke → `/projects` shows 6 projects, all under Lux.
2. Open one project → CrewPanel shows ~24 crew including a "Clyde Bessey",
   "Tyler Heckerman", "Kelly Pratt" (the cloned aliases).
3. Sign in as Clyde (real founder) → `/projects` shows only Origin Point's
   6 projects, no Lux visibility.
4. Image surfaces (moodboard, location attachments) may show broken
   thumbnails — known gap, fix forward.

## Follow-ups

- Storage RLS exception for `is_demo=true` reads, OR re-upload seed images
  per cloned project. Triage after smoke test reveals scope.
- Productize the cloner into the auth flow (auto-clone-on-team-creation)
  if a second external tester arrives.
