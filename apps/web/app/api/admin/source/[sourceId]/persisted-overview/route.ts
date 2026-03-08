import { NextResponse } from "next/server"
import { getPersistedOverview, isDatabaseConfigured } from "@repo/db/index"

export async function GET(_: Request, context: { params: Promise<{ sourceId: string }> }) {
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

  try {
    const overview = await getPersistedOverview(sourceId)
    if (!overview) {
      return NextResponse.json(
        {
          status: "not_found",
          sourceId,
          message: "Source has not been persisted to PostgreSQL yet",
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      status: "ok",
      sourceId,
      ...overview,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown persisted overview error",
      },
      { status: 500 },
    )
  }
}
