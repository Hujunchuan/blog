import { NextResponse } from "next/server"
import { getSourceOverview } from "@/lib/knowledge-service"

export async function GET(_: Request, context: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await context.params
  const overview = await getSourceOverview(sourceId)
  return NextResponse.json(overview)
}
