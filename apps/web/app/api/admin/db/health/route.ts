import { NextResponse } from "next/server"
import { checkDatabaseHealth, isDatabaseConfigured } from "@repo/db/index"

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      status: "not_configured",
      configured: false,
    })
  }

  try {
    const result = await checkDatabaseHealth()
    return NextResponse.json({
      configured: true,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        configured: true,
        message: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 500 },
    )
  }
}
