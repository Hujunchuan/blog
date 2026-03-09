import { createWorkspaceAnnotation, isDatabaseConfigured } from "@repo/db/index"
import { WorkspaceAnnotationKind } from "@repo/core/types"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type CreateWorkspaceNotePayload = {
  workspaceNodeId?: string
  body?: string
  kind?: WorkspaceAnnotationKind
  metadata?: Record<string, unknown>
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
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
    const payload = (await request.json()) as CreateWorkspaceNotePayload
    const workspaceNodeId = payload.workspaceNodeId?.trim()
    const body = payload.body?.trim()

    if (!workspaceNodeId || !body) {
      return NextResponse.json(
        {
          status: "invalid_input",
          message: "workspaceNodeId and body are required",
        },
        { status: 400 },
      )
    }

    const item = await createWorkspaceAnnotation({
      workspaceViewId: workspaceId,
      workspaceNodeId,
      body,
      kind: payload.kind ?? "note",
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
        message: error instanceof Error ? error.message : "Unknown workspace note error",
      },
      { status: 500 },
    )
  }
}
