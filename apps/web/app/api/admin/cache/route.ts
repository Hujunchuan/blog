import { NextResponse } from "next/server"
import { invalidateSnapshot } from "@/lib/knowledge-service"

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get("sourceId") ?? undefined
  await invalidateSnapshot(sourceId)

  return NextResponse.json({
    status: "ok",
    invalidated: sourceId ?? "all",
  })
}
