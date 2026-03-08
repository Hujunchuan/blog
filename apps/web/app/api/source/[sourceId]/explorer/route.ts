import { NextResponse } from "next/server"
import { getExplorerTree } from "@/lib/knowledge-service"

export async function GET(_: Request, context: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await context.params
  const tree = await getExplorerTree(sourceId)
  return NextResponse.json({ items: tree })
}
