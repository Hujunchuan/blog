import { NextResponse } from "next/server"
import { getGraph } from "@/lib/knowledge-service"

export async function GET(_: Request, context: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await context.params
  const graph = await getGraph(sourceId)
  return NextResponse.json(graph)
}
