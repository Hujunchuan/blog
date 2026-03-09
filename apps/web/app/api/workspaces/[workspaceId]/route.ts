import { isDatabaseConfigured, replaceWorkspaceCapture, upsertSource, withPgClient } from "@repo/db/index"
import { WorkspaceEdgeType, WorkspaceNodeType } from "@repo/core/types"
import { NextResponse } from "next/server"
import { getWorkspaceView } from "@/lib/knowledge-service"
import { getKnowledgeSourcesConfig } from "@/lib/config"

export const dynamic = "force-dynamic"

type ReplaceWorkspaceCapturePayload = {
  name?: string
  description?: string
  sourceId?: string
  layoutMode?: "local" | "global"
  mode?: "documents" | "knowledge"
  focusNodeId?: string
  depth?: number
  nodes?: Array<{
    graphId?: string
    sourceId?: string
    nodeType?: WorkspaceNodeType
    entityKey?: string
    documentSlug?: string
    referenceUrl?: string
    label?: string
    x?: number
    y?: number
    pinned?: boolean
    collapsed?: boolean
    metadata?: Record<string, unknown>
  }>
  edges?: Array<{
    fromGraphId?: string
    toGraphId?: string
    edgeType?: WorkspaceEdgeType
    weight?: number
    sourceRelationKey?: string
    metadata?: Record<string, unknown>
  }>
}

function asFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function collectSourceIds(
  currentSourceId: string,
  nodes: Iterable<{
    sourceId?: string
  }>,
) {
  const sourceIds = new Set<string>([currentSourceId])
  for (const node of nodes) {
    const sourceId = node.sourceId?.trim()
    if (sourceId) {
      sourceIds.add(sourceId)
    }
  }

  return [...sourceIds]
}

async function ensureSourceRecords(sourceIds: string[]) {
  const configuredSources = await getKnowledgeSourcesConfig()
  const sourceMap = new Map(configuredSources.map((source) => [source.id, source]))

  await withPgClient(async (client) => {
    for (const sourceId of sourceIds) {
      const source = sourceMap.get(sourceId)
      if (!source) {
        continue
      }

      await upsertSource(client, source)
    }
  })
}

export async function GET(_: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params

  try {
    const workspace = await getWorkspaceView(workspaceId)
    if (!workspace) {
      return NextResponse.json(
        {
          status: "not_found",
          message: `Unknown workspace: ${workspaceId}`,
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      status: "ok",
      workspace,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown workspace detail error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        status: "not_configured",
        message: "DATABASE_URL is not configured",
      },
      { status: 400 },
    )
  }

  const { workspaceId } = await context.params

  try {
    const payload = (await request.json()) as ReplaceWorkspaceCapturePayload
    const sourceId = payload.sourceId?.trim()
    const nodes = payload.nodes ?? []
    const edges = payload.edges ?? []

    if (!sourceId || nodes.length === 0) {
      return NextResponse.json(
        {
          status: "invalid_input",
          message: "sourceId and at least one node are required",
        },
        { status: 400 },
      )
    }

    const uniqueNodes = new Map<string, NonNullable<ReplaceWorkspaceCapturePayload["nodes"]>[number]>()
    for (const node of nodes) {
      const graphId = node.graphId?.trim()
      const label = node.label?.trim()
      if (!graphId || !label) {
        continue
      }

      uniqueNodes.set(graphId, {
        ...node,
        graphId,
        label,
      })
    }

    const uniqueEdges = new Map<string, NonNullable<ReplaceWorkspaceCapturePayload["edges"]>[number]>()
    for (const edge of edges) {
      const fromGraphId = edge.fromGraphId?.trim()
      const toGraphId = edge.toGraphId?.trim()
      if (!fromGraphId || !toGraphId || fromGraphId === toGraphId) {
        continue
      }
      if (!uniqueNodes.has(fromGraphId) || !uniqueNodes.has(toGraphId)) {
        continue
      }

      const key = [fromGraphId, toGraphId].sort().join("::")
      if (!uniqueEdges.has(key)) {
        uniqueEdges.set(key, {
          ...edge,
          fromGraphId,
          toGraphId,
        })
      }
    }

    const workspaceSourceIds = collectSourceIds(sourceId, uniqueNodes.values())
    await ensureSourceRecords(workspaceSourceIds)

    const workspace = await replaceWorkspaceCapture(workspaceId, {
      view: {
        ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
        ...(typeof payload.description === "string" ? { description: payload.description.trim() || undefined } : {}),
        sourceScope: {
          sourceIds: workspaceSourceIds,
        },
        layoutMode: payload.layoutMode === "global" ? "global" : "local",
        metadata: {
          mode: payload.mode === "knowledge" ? "knowledge" : "documents",
          focusNodeId: payload.focusNodeId?.trim() || undefined,
          depth: typeof payload.depth === "number" ? payload.depth : undefined,
        },
      },
      nodes: [...uniqueNodes.values()].map((node) => ({
        graphId: node.graphId!,
        sourceId: node.sourceId?.trim() || undefined,
        nodeType: node.nodeType ?? "synthetic",
        entityKey: node.entityKey?.trim() || undefined,
        documentSlug: node.documentSlug?.trim() || undefined,
        referenceUrl: node.referenceUrl?.trim() || undefined,
        label: node.label!,
        x: asFiniteNumber(node.x),
        y: asFiniteNumber(node.y),
        pinned: Boolean(node.pinned),
        collapsed: Boolean(node.collapsed),
        metadata: asRecord(node.metadata),
      })),
      edges: [...uniqueEdges.values()].map((edge) => ({
        fromGraphId: edge.fromGraphId!,
        toGraphId: edge.toGraphId!,
        edgeType: edge.edgeType ?? "manual",
        weight: asFiniteNumber(edge.weight, 1),
        sourceRelationKey: edge.sourceRelationKey?.trim() || undefined,
        metadata: asRecord(edge.metadata),
      })),
    })

    if (!workspace) {
      return NextResponse.json(
        {
          status: "not_found",
          message: `Unknown workspace: ${workspaceId}`,
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      status: "ok",
      item: workspace,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown workspace update error",
      },
      { status: 500 },
    )
  }
}
