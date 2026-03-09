import { createWorkspaceEdge, isDatabaseConfigured } from "@repo/db/index"
import { WorkspaceEdgeType } from "@repo/core/types"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type CreateWorkspaceRelationPayload = {
  fromNodeId?: string
  toNodeId?: string
  edgeType?: WorkspaceEdgeType
  weight?: number
  sourceRelationKey?: string
  metadata?: Record<string, unknown>
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asFiniteNumber(value: unknown, fallback = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
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
    const payload = (await request.json()) as CreateWorkspaceRelationPayload
    const fromNodeId = payload.fromNodeId?.trim()
    const toNodeId = payload.toNodeId?.trim()

    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
      return NextResponse.json(
        {
          status: "invalid_input",
          message: "Distinct fromNodeId and toNodeId are required",
        },
        { status: 400 },
      )
    }

    const item = await createWorkspaceEdge({
      workspaceViewId: workspaceId,
      fromNodeId,
      toNodeId,
      edgeType: payload.edgeType ?? "manual",
      weight: asFiniteNumber(payload.weight, 1),
      sourceRelationKey: payload.sourceRelationKey?.trim() || undefined,
      metadata: asRecord(payload.metadata),
    })

    return NextResponse.json({
      status: "ok",
      item,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown workspace relation error",
      },
      { status: 500 },
    )
  }
}
