// Detail PDF — internal review document. Multi-page; one block per
// account with all line items underneath. See spec §8.
//
// Uses SUPABASE_SERVICE_ROLE_KEY (server-only, bypasses RLS) for the
// fetch. Caller must hold producer-tier access on the budget's project;
// enforced via requireProducerAccess + getBudgetProjectId at route entry.

import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createElement, type ReactElement } from 'react'
import {
  fetchBudgetExportData,
  projectSlug,
  todayIso,
  resolveActiveVersion,
} from '@/lib/budget-export/fetch-budget-tree'
import {
  getBudgetProjectId,
  requireProducerAccess,
} from '@/lib/auth/server-authz'
import { DetailPdfDocument } from '@/components/budget/DetailPdfDocument'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(
  request: Request,
  { params }: { params: { budgetId: string } },
) {
  const url = new URL(request.url)
  const versionParam = url.searchParams.get('version')

  const projectId = await getBudgetProjectId(params.budgetId)
  if (!projectId) return new Response('Budget not found', { status: 404 })
  const authz = await requireProducerAccess(projectId)
  if (!authz.ok) return new Response(authz.message, { status: authz.status })

  const data = await fetchBudgetExportData(params.budgetId).catch((e) => {
    console.error('Detail PDF fetch failed:', e)
    return null
  })
  if (!data) return new Response('Budget not found', { status: 404 })

  const activeVersion = resolveActiveVersion(data.budget.versions, versionParam)
  const rollupActive = data.rollupByVersionId.get(activeVersion.id)
  if (!rollupActive) return new Response('Active version rollup missing', { status: 500 })

  const doc = createElement(DetailPdfDocument, {
    projectName: data.project.name,
    projectClient: (data.project as { client?: string | null }).client ?? null,
    projectType:   (data.project as { type?: string | null }).type ?? null,
    currency: data.budget.currency,
    activeVersion,
    versions: data.budget.versions,
    accounts: data.budget.accounts,
    lines: data.budget.lines,
    markups: data.budget.markups,
    rollupActive,
    rollupByVersionId: data.rollupByVersionId,
    generatedAt: new Date(),
  })

  let buffer: Buffer
  try {
    // Cast: see topsheet-pdf/route.ts for the why.
    buffer = await renderToBuffer(doc as unknown as ReactElement<DocumentProps>)
  } catch (e) {
    console.error('Detail PDF render failed:', e)
    return new Response('PDF generation failed', { status: 500 })
  }

  const filename = `${projectSlug(data.project.name)}-detail-${activeVersion.kind}-${todayIso()}.pdf`
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
