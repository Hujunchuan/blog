import { PoolClient } from "pg"
import { KnowledgeSource } from "../../core/src"

export async function upsertSource(client: PoolClient, source: KnowledgeSource) {
  await client.query(
    `
      INSERT INTO sources (id, name, type, location, enabled, description, settings, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        location = EXCLUDED.location,
        enabled = EXCLUDED.enabled,
        description = EXCLUDED.description,
        settings = EXCLUDED.settings,
        updated_at = NOW()
    `,
    [
      source.id,
      source.name,
      source.type,
      source.location,
      source.enabled,
      source.description ?? null,
      JSON.stringify(source.settings ?? {}),
    ],
  )
}
