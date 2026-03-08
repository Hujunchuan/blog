import { NextResponse } from "next/server"
import { getKnowledgeImpact } from "@/lib/knowledge-service"

export async function GET(request: Request, context: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await context.params
  const { searchParams } = new URL(request.url)
  const entityKey = searchParams.get("entityKey") ?? undefined
  const slug = searchParams.get("slug") ?? undefined
  const depthValue = Number(searchParams.get("depth") ?? "2")
  const limitValue = Number(searchParams.get("limit") ?? "40")
  const depth = Number.isFinite(depthValue) ? depthValue : 2
  const limit = Number.isFinite(limitValue) ? limitValue : 40

  if (!entityKey && !slug) {
    return NextResponse.json(
      {
        status: "invalid_request",
        message: "Expected either entityKey or slug",
      },
      { status: 400 },
    )
  }

  const result = await getKnowledgeImpact(sourceId, {
    entityKey,
    slug,
    depth,
    limit,
  })

  if (!result) {
    return NextResponse.json(
      {
        status: "not_found",
        message: "No impact graph found for the provided input",
      },
      { status: 404 },
    )
  }

  return NextResponse.json(result)
}
