import { PoolClient } from "pg"

export async function startSyncRun(client: PoolClient, sourceId: string) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO sync_runs (source_id, status)
      VALUES ($1, 'running')
      RETURNING id
    `,
    [sourceId],
  )

  return result.rows[0]?.id
}

export async function finishSyncRun(
  client: PoolClient,
  syncRunId: string,
  input: {
    status: "success" | "failed"
    stats?: Record<string, unknown>
    errorMessage?: string
  },
) {
  await client.query(
    `
      UPDATE sync_runs
      SET status = $2,
          finished_at = NOW(),
          stats = $3::jsonb,
          error_message = $4
      WHERE id = $1
    `,
    [syncRunId, input.status, JSON.stringify(input.stats ?? {}), input.errorMessage ?? null],
  )
}
