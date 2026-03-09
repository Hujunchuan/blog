import { NextResponse } from "next/server"
import { listWorkspaceViews } from "@/lib/knowledge-service"

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
