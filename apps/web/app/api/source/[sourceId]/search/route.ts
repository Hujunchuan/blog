import { NextResponse } from "next/server"
import { searchDocuments } from "@/lib/knowledge-service"

export async function GET(request: Request, context: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await context.params
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") ?? ""
  const items = await searchDocuments(sourceId, query)
  return NextResponse.json({ items })
}
