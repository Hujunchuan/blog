import { NextResponse } from "next/server"
import { listSources } from "@/lib/knowledge-service"

export async function GET() {
  const sources = await listSources()
  return NextResponse.json({
    status: "ok",
    sources: sources.length,
  })
}
