import { NextResponse } from "next/server"
import { getWorkspaceView } from "@/lib/knowledge-service"

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
