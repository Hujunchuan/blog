import { NextResponse } from "next/server"
import { getGraph } from "@/lib/knowledge-service"

export async function GET(request: Request, context: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await context.params
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("mode") === "knowledge" ? "knowledge" : "documents"
  const graph = await getGraph(sourceId, mode)
  return NextResponse.json(graph)
}
