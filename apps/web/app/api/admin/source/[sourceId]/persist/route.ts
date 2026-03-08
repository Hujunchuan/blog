import { NextResponse } from "next/server"
import { isDatabaseConfigured, persistSourceSnapshot } from "@repo/db/index"
import { getSnapshot, listSources } from "@/lib/knowledge-service"

export async function POST(_: Request, context: { params: Promise<{ sourceId: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        status: "not_configured",
        message: "DATABASE_URL is not configured",
      },
      { status: 400 },
    )
  }

  const { sourceId } = await context.params
  const source = (await listSources()).find((item) => item.id === sourceId)
  if (!source) {
    return NextResponse.json(
      {
        status: "not_found",
        message: `Unknown source: ${sourceId}`,
      },
      { status: 404 },
    )
  }

  try {
    const snapshot = await getSnapshot(sourceId)
    const result = await persistSourceSnapshot(source, snapshot)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown persistence error",
      },
      { status: 500 },
    )
  }
}
