import { createWorkspaceCapture, isDatabaseConfigured } from "@repo/db/index"
import { WorkspaceEdgeType, WorkspaceNodeType } from "@repo/core/types"
import { NextResponse } from "next/server"
import { listWorkspaceViews } from "@/lib/knowledge-service"

export const dynamic = "force-dynamic"

type CreateWorkspaceCapturePayload = {
  name?: string
  description?: string
  sourceId?: string
  layoutMode?: "local" | "global"
  mode?: "documents" | "knowledge"
  focusNodeId?: string
  depth?: number
  nodes?: Array<{
    graphId?: string
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get("sourceId") ?? undefined

  try {
    const items = await listWorkspaceViews(sourceId)
    return NextResponse.json({
      status: "ok",
      items,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown workspace list error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        status: "not_configured",
        message: "DATABASE_URL is not configured",
      },
      { status: 400 },
    )
  }

  try {
    const payload = (await request.json()) as CreateWorkspaceCapturePayload
    const name = payload.name?.trim()
    const sourceId = payload.sourceId?.trim()
    const nodes = payload.nodes ?? []
    const edges = payload.edges ?? []

    if (!name || !sourceId) {
      return NextResponse.json(
        {
          status: "invalid_input",
          message: "Workspace name and sourceId are required",
        },
        { status: 400 },
      )
    }

    if (nodes.length === 0) {
      return NextResponse.json(
        {
          status: "invalid_input",
          message: "At least one node is required to save a workspace view",
        },
        { status: 400 },
      )
    }

    const uniqueNodes = new Map<string, NonNullable<CreateWorkspaceCapturePayload["nodes"]>[number]>()
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

    if (uniqueNodes.size === 0) {
      return NextResponse.json(
        {
          status: "invalid_input",
          message: "No valid graph nodes were provided",
        },
        { status: 400 },
      )
    }

    const uniqueEdges = new Map<string, NonNullable<CreateWorkspaceCapturePayload["edges"]>[number]>()
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

    const workspace = await createWorkspaceCapture({
      view: {
        name,
        description: payload.description?.trim() || undefined,
        sourceScope: {
          sourceIds: [sourceId],
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

    return NextResponse.json({
      status: "ok",
      item: workspace,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown workspace create error",
      },
      { status: 500 },
    )
  }
}
