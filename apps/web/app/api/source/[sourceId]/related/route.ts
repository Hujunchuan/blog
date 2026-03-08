import { NextResponse } from "next/server"
import { getRelatedKnowledge } from "@/lib/knowledge-service"

export async function GET(request: Request, context: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await context.params
  const { searchParams } = new URL(request.url)
  const entityKey = searchParams.get("entityKey") ?? undefined
  const slug = searchParams.get("slug") ?? undefined
  const limitValue = Number(searchParams.get("limit") ?? "24")
  const limit = Number.isFinite(limitValue) ? limitValue : 24

  if (!entityKey && !slug) {
    return NextResponse.json(
      {
        status: "invalid_request",
        message: "Expected either entityKey or slug",
      },
      { status: 400 },
    )
  }

  const result = await getRelatedKnowledge(sourceId, {
    entityKey,
    slug,
    limit,
  })

  if (!result) {
    return NextResponse.json(
      {
        status: "not_found",
        message: "No related node found for the provided input",
      },
      { status: 404 },
    )
  }

  return NextResponse.json(result)
}
