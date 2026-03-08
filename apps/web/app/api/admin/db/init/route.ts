import { NextResponse } from "next/server"
import { initializeDatabaseSchema, isDatabaseConfigured } from "@repo/db/index"

export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        status: "not_configured",
        message: "DATABASE_URL is not configured",
      },
      { status: 400 },
    )
  }

  try {
    await initializeDatabaseSchema()
    return NextResponse.json({
      status: "ok",
      message: "Database schema initialized",
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown schema initialization error",
      },
      { status: 500 },
    )
  }
}
