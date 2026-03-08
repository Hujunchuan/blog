import { PoolClient } from "pg"
import { KnowledgeEntity, KnowledgeRelation } from "../../core/src"

export async function replaceEntitiesForSource(
  client: PoolClient,
  sourceId: string,
  entities: KnowledgeEntity[],
) {
  await client.query(`DELETE FROM entities WHERE source_id = $1`, [sourceId])

  for (const entity of entities) {
    await client.query(
      `
        INSERT INTO entities (
          source_id,
          entity_key,
          entity_type,
          canonical_name,
          slug,
          document_slug,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      `,
      [
        sourceId,
        entity.entityKey,
        entity.entityType,
        entity.canonicalName,
        entity.slug ?? null,
        entity.documentSlug ?? null,
        JSON.stringify(entity.metadata ?? {}),
      ],
    )
  }
}

export async function replaceRelationsForSource(
  client: PoolClient,
  sourceId: string,
  relations: KnowledgeRelation[],
) {
  await client.query(`DELETE FROM relations WHERE source_id = $1`, [sourceId])

  for (const relation of relations) {
    await client.query(
      `
        INSERT INTO relations (
          source_id,
          relation_key,
          relation_type,
          from_entity_key,
          to_entity_key,
          evidence_document_slug,
          weight,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      `,
      [
        sourceId,
        relation.relationKey,
        relation.relationType,
        relation.fromEntityKey,
        relation.toEntityKey,
        relation.evidenceDocumentSlug ?? null,
        relation.weight ?? 1,
        JSON.stringify(relation.metadata ?? {}),
      ],
    )
  }
}
