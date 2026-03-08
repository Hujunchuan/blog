import { withPgClient } from "./client"

export async function checkDatabaseHealth() {
  return withPgClient(async (client) => {
    const result = await client.query<{ now: string }>("SELECT NOW()::text AS now")
    return {
      status: "ok" as const,
      serverTime: result.rows[0]?.now,
    }
  })
}
