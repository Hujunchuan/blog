import { Pool, PoolClient } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var __knowledgePgPool__: Pool | undefined
}

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured")
  }

  return new Pool({
    connectionString,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  })
}

export function getPgPool() {
  if (!globalThis.__knowledgePgPool__) {
    globalThis.__knowledgePgPool__ = createPool()
  }

  return globalThis.__knowledgePgPool__
}

export async function withPgClient<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPgPool().connect()
  try {
    return await callback(client)
  } finally {
    client.release()
  }
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL)
}
