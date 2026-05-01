// Topsheet PDF — client-facing exec summary. Cream-paper visual system
// from Frame C, rendered via @react-pdf/renderer. See spec §8.
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
import { buildTopsheetProps } from '@/lib/budget-export/build-topsheet-props'
import { TopsheetPdfDocument } from '@/components/budget/TopsheetPdfDocument'

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
    console.error('Topsheet PDF fetch failed:', e)
    return null
  })
  if (!data) return new Response('Budget not found', { status: 404 })

  const activeVersion = resolveActiveVersion(data.budget.versions, versionParam)
  const props = buildTopsheetProps(data, activeVersion.id)

  const doc = createElement(TopsheetPdfDocument, {
    projectName: data.project.name,
    projectClient: (data.project as { client?: string | null }).client ?? null,
    projectType:   (data.project as { type?: string | null }).type ?? null,
    currency: data.budget.currency,
    versions: data.budget.versions,
    accounts: props.topAccounts,
    markups: data.budget.markups,
    perVersion: props.perVersion,
    activeVersionId: activeVersion.id,
    actualsByAccountId: props.actualsByAccountId,
    grandActuals: props.grandActuals,
    generatedAt: new Date(),
    sectionSubtotalsByVersion: props.sectionSubtotalsByVersion,
    sectionActuals: props.sectionActuals,
  })

  let buffer: Buffer
  try {
    // Cast: TopsheetPdfDocument returns <Document>...</Document>, but
    // TypeScript loses the DocumentProps element type through the
    // function-component wrapper. The runtime tree is what react-pdf
    // expects.
    buffer = await renderToBuffer(doc as unknown as ReactElement<DocumentProps>)
  } catch (e) {
    console.error('Topsheet PDF render failed:', e)
    return new Response('PDF generation failed', { status: 500 })
  }

  const filename = `${projectSlug(data.project.name)}-topsheet-${activeVersion.kind}-${todayIso()}.pdf`
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
