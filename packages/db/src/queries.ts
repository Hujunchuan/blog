import {
  KnowledgeEntity,
  KnowledgeEvidenceDocument,
  KnowledgeEvidenceResult,
  KnowledgeImpactResult,
  KnowledgeNervousSystemSnapshot,
  KnowledgeOverview,
  KnowledgeRelatedResult,
  ParsedKnowledgeDocument,
  RelatedKnowledgeRelation,
} from "../../core/src"
import { buildKnowledgeImpact } from "../../sync/src/nervousSystem"
import { createGraph, createTree } from "../../sync/src/projections"
import { withPgClient } from "./client"

type DocumentRow = {
  relative_path: string
  slug: string
  title: string
  content: string
  summary: string
  tags: unknown
  links: unknown
  headings: unknown
  updated_at: string
}

type LatestSyncRunRow = {
  id: string
  status: string
  started_at: string
  finished_at: string | null
  stats: Record<string, unknown>
  error_message: string | null
}

type EntityRow = {
  entity_key: string
  entity_type: KnowledgeEntity["entityType"]
  canonical_name: string
  slug: string | null
  document_slug: string | null
  metadata: unknown
}

type RelationRow = {
  relation_key: string
  relation_type: RelatedKnowledgeRelation["relationType"]
  from_entity_key: string
  to_entity_key: string
  evidence_document_slug: string | null
  weight: number
  metadata: unknown
  direction?: RelatedKnowledgeRelation["direction"]
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function mapDocumentRow(row: DocumentRow, sourceId: string): ParsedKnowledgeDocument {
  return {
    sourceId,
    absolutePath: "",
    relativePath: row.relative_path,
    slug: row.slug,
    title: row.title,
    content: row.content,
    summary: row.summary,
    tags: asStringArray(row.tags),
    links: asStringArray(row.links),
    headings: asStringArray(row.headings),
    updatedAt: row.updated_at,
  }
}

function mapEntityRow(row: EntityRow, sourceId: string): KnowledgeEntity {
  return {
    sourceId,
    entityKey: row.entity_key,
    entityType: row.entity_type,
    canonicalName: row.canonical_name,
    slug: row.slug ?? undefined,
    documentSlug: row.document_slug ?? undefined,
    metadata: asRecord(row.metadata),
  }
}

function mapRelationRow(row: RelationRow, sourceId: string): RelatedKnowledgeRelation {
  return {
    sourceId,
    relationKey: row.relation_key,
    relationType: row.relation_type,
    fromEntityKey: row.from_entity_key,
    toEntityKey: row.to_entity_key,
    evidenceDocumentSlug: row.evidence_document_slug ?? undefined,
    weight: row.weight,
    metadata: asRecord(row.metadata),
    direction: row.direction ?? "outgoing",
  }
}

function mapKnowledgeRelationRow(row: RelationRow, sourceId: string) {
  return {
    sourceId,
    relationKey: row.relation_key,
    relationType: row.relation_type,
    fromEntityKey: row.from_entity_key,
    toEntityKey: row.to_entity_key,
    evidenceDocumentSlug: row.evidence_document_slug ?? undefined,
    weight: row.weight,
    metadata: asRecord(row.metadata),
  }
}

async function hasPersistedSource(sourceId: string) {
  return withPgClient(async (client) => {
    const result = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS(
          SELECT 1
          FROM sources
          WHERE id = $1
        ) AS exists
      `,
      [sourceId],
    )

    return result.rows[0]?.exists ?? false
  })
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  return 0
}

async function listPersistedDocuments(sourceId: string): Promise<ParsedKnowledgeDocument[]> {
  return withPgClient(async (client) => {
    const result = await client.query<DocumentRow>(
      `
        SELECT relative_path, slug, title, content, summary, tags, links, headings, updated_at::text
        FROM documents
        WHERE source_id = $1
        ORDER BY slug ASC
      `,
      [sourceId],
    )

    return result.rows.map((row) => mapDocumentRow(row, sourceId))
  })
}

async function listPersistedNervousSystem(sourceId: string): Promise<KnowledgeNervousSystemSnapshot> {
  return withPgClient(async (client) => {
    const [entitiesResult, relationsResult] = await Promise.all([
      client.query<EntityRow>(
        `
          SELECT entity_key, entity_type, canonical_name, slug, document_slug, metadata
          FROM entities
          WHERE source_id = $1
          ORDER BY entity_type ASC, canonical_name ASC, entity_key ASC
        `,
        [sourceId],
      ),
      client.query<RelationRow>(
        `
          SELECT relation_key, relation_type, from_entity_key, to_entity_key, evidence_document_slug, weight, metadata
          FROM relations
          WHERE source_id = $1
          ORDER BY relation_type ASC, relation_key ASC
        `,
        [sourceId],
      ),
    ])

    return {
      entities: entitiesResult.rows.map((row) => mapEntityRow(row, sourceId)),
      relations: relationsResult.rows.map((row) => mapKnowledgeRelationRow(row, sourceId)),
    }
  })
}

export async function getPersistedOverview(
  sourceId: string,
): Promise<(KnowledgeOverview & { latestSyncRun: LatestSyncRunRow | null }) | null> {
  if (!(await hasPersistedSource(sourceId))) {
    return null
  }

  return withPgClient(async (client) => {
    const latestSyncRunResult = await client.query<LatestSyncRunRow>(
      `
        SELECT id, status, started_at::text, finished_at::text, stats, error_message
        FROM sync_runs
        WHERE source_id = $1
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [sourceId],
    )

    const latestSyncRun = latestSyncRunResult.rows[0] ?? null
    const syncStats = latestSyncRun?.stats ?? {}

    const recentDocumentsResult = await client.query<DocumentRow>(
      `
        SELECT relative_path, slug, title, content, summary, tags, links, headings, updated_at::text
        FROM documents
        WHERE source_id = $1
        ORDER BY updated_at DESC, slug ASC
        LIMIT 8
      `,
      [sourceId],
    )

    const topTagsResult = await client.query<{ tag: string; count: string }>(
      `
        SELECT tag_value AS tag, COUNT(*)::text AS count
        FROM (
          SELECT jsonb_array_elements_text(tags) AS tag_value
          FROM documents
          WHERE source_id = $1
        ) tag_projection
        GROUP BY tag_value
        ORDER BY COUNT(*) DESC, tag_value ASC
        LIMIT 12
      `,
      [sourceId],
    )

    const densestDocumentsResult = await client.query<{ slug: string; title: string; link_count: string }>(
      `
        SELECT slug, title, jsonb_array_length(links)::text AS link_count
        FROM documents
        WHERE source_id = $1
        ORDER BY jsonb_array_length(links) DESC, title ASC
        LIMIT 8
      `,
      [sourceId],
    )

    const documentCountResult = await client.query<{ value: string }>(
      `
        SELECT COUNT(*)::text AS value
        FROM documents
        WHERE source_id = $1
      `,
      [sourceId],
    )

    return {
      documentCount: toNumber(syncStats.documentCount ?? documentCountResult.rows[0]?.value ?? 0),
      folderCount: toNumber(syncStats.folderCount ?? 0),
      tagCount: toNumber(syncStats.tagCount ?? topTagsResult.rows.length),
      linkCount: toNumber(syncStats.linkCount ?? 0),
      recentDocuments: recentDocumentsResult.rows.map((row) => {
        const document = mapDocumentRow(row, sourceId)
        return {
          slug: document.slug,
          title: document.title,
          updatedAt: document.updatedAt,
          summary: document.summary,
        }
      }),
      topTags: topTagsResult.rows.map((row) => ({
        tag: row.tag,
        count: Number(row.count),
      })),
      densestDocuments: densestDocumentsResult.rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        linkCount: Number(row.link_count),
      })),
      latestSyncRun,
    }
  })
}

export async function searchPersistedDocuments(sourceId: string, query: string): Promise<ParsedKnowledgeDocument[] | null> {
  if (!(await hasPersistedSource(sourceId))) {
    return null
  }

  const normalized = query.trim().toLowerCase()

  return withPgClient(async (client) => {
    if (!normalized) {
      const result = await client.query<DocumentRow>(
        `
          SELECT relative_path, slug, title, content, summary, tags, links, headings, updated_at::text
          FROM documents
          WHERE source_id = $1
          ORDER BY updated_at DESC, slug ASC
          LIMIT 20
        `,
        [sourceId],
      )

      return result.rows.map((row) => mapDocumentRow(row, sourceId))
    }

    const result = await client.query<DocumentRow & { score: string }>(
      `
        SELECT
          relative_path,
          slug,
          title,
          content,
          summary,
          tags,
          links,
          headings,
          updated_at::text,
          (
            CASE WHEN POSITION($2 IN LOWER(title)) > 0 THEN 6 ELSE 0 END +
            CASE WHEN POSITION($2 IN LOWER(summary)) > 0 THEN 3 ELSE 0 END +
            CASE WHEN POSITION($2 IN LOWER(content)) > 0 THEN 1 ELSE 0 END +
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(tags) AS tag_value
                WHERE POSITION($2 IN LOWER(tag_value)) > 0
              ) THEN 4
              ELSE 0
            END
          )::text AS score
        FROM documents
        WHERE source_id = $1
        ORDER BY
          (
            CASE WHEN POSITION($2 IN LOWER(title)) > 0 THEN 6 ELSE 0 END +
            CASE WHEN POSITION($2 IN LOWER(summary)) > 0 THEN 3 ELSE 0 END +
            CASE WHEN POSITION($2 IN LOWER(content)) > 0 THEN 1 ELSE 0 END +
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(tags) AS tag_value
                WHERE POSITION($2 IN LOWER(tag_value)) > 0
              ) THEN 4
              ELSE 0
            END
          ) DESC,
          updated_at DESC,
          slug ASC
        LIMIT 30
      `,
      [sourceId, normalized],
    )

    return result.rows
      .filter((row) => Number(row.score) > 0)
      .map((row) => mapDocumentRow(row, sourceId))
  })
}

export async function getPersistedDocumentBySlug(
  sourceId: string,
  slug: string,
): Promise<ParsedKnowledgeDocument | null> {
  if (!(await hasPersistedSource(sourceId))) {
    return null
  }

  return withPgClient(async (client) => {
    const result = await client.query<DocumentRow>(
      `
        SELECT relative_path, slug, title, content, summary, tags, links, headings, updated_at::text
        FROM documents
        WHERE source_id = $1 AND slug = $2
        LIMIT 1
      `,
      [sourceId, slug],
    )

    const row = result.rows[0]
    return row ? mapDocumentRow(row, sourceId) : null
  })
}

export async function getPersistedExplorerTree(sourceId: string) {
  if (!(await hasPersistedSource(sourceId))) {
    return null
  }

  const documents = await listPersistedDocuments(sourceId)
  return createTree(documents)
}

export async function getPersistedGraph(sourceId: string) {
  if (!(await hasPersistedSource(sourceId))) {
    return null
  }

  const documents = await listPersistedDocuments(sourceId)
  return createGraph(documents)
}

export async function getPersistedRelated(
  sourceId: string,
  input: { entityKey?: string; slug?: string; limit?: number },
): Promise<KnowledgeRelatedResult | null> {
  if (!(await hasPersistedSource(sourceId))) {
    return null
  }

  const limit = Math.max(1, Math.min(input.limit ?? 24, 100))

  return withPgClient(async (client) => {
    const rootResult = await client.query<EntityRow>(
      `
        SELECT entity_key, entity_type, canonical_name, slug, document_slug, metadata
        FROM entities
        WHERE source_id = $1
          AND (
            ($2::text IS NOT NULL AND entity_key = $2)
            OR ($3::text IS NOT NULL AND slug = $3)
          )
        ORDER BY
          CASE
            WHEN $2::text IS NOT NULL AND entity_key = $2 THEN 0
            ELSE 1
          END,
          entity_key ASC
        LIMIT 1
      `,
      [sourceId, input.entityKey ?? null, input.slug ?? null],
    )

    const rootRow = rootResult.rows[0]
    if (!rootRow) {
      return null
    }

    const root = mapEntityRow(rootRow, sourceId)
    const relationsResult = await client.query<RelationRow>(
      `
        SELECT
          relation_key,
          relation_type,
          from_entity_key,
          to_entity_key,
          evidence_document_slug,
          weight,
          metadata,
          CASE
            WHEN from_entity_key = $2 THEN 'outgoing'
            ELSE 'incoming'
          END AS direction
        FROM relations
        WHERE source_id = $1
          AND (from_entity_key = $2 OR to_entity_key = $2)
        ORDER BY weight DESC, relation_type ASC, relation_key ASC
        LIMIT $3
      `,
      [sourceId, root.entityKey, limit],
    )

    const relations = relationsResult.rows.map((row) => mapRelationRow(row, sourceId))
    const entityKeys = [...new Set([root.entityKey, ...relations.flatMap((relation) => [relation.fromEntityKey, relation.toEntityKey])])]

    const entitiesResult = await client.query<EntityRow>(
      `
        SELECT entity_key, entity_type, canonical_name, slug, document_slug, metadata
        FROM entities
        WHERE source_id = $1
          AND entity_key = ANY($2::text[])
        ORDER BY entity_type ASC, canonical_name ASC, entity_key ASC
      `,
      [sourceId, entityKeys],
    )

    return {
      root,
      entities: entitiesResult.rows.map((row) => mapEntityRow(row, sourceId)),
      relations,
    }
  })
}

export async function getPersistedImpact(
  sourceId: string,
  input: { entityKey?: string; slug?: string; depth?: number; limit?: number },
): Promise<KnowledgeImpactResult | null> {
  if (!(await hasPersistedSource(sourceId))) {
    return null
  }

  const nervousSystem = await listPersistedNervousSystem(sourceId)
  const root =
    nervousSystem.entities.find((entity) => input.entityKey && entity.entityKey === input.entityKey) ??
    nervousSystem.entities.find((entity) => input.slug && entity.slug === input.slug)

  if (!root) {
    return null
  }

  return buildKnowledgeImpact(nervousSystem, root.entityKey, {
    depth: input.depth,
    limit: input.limit,
  })
}

export async function getPersistedEvidence(
  sourceId: string,
  input: { entityKey?: string; slug?: string; limit?: number },
): Promise<KnowledgeEvidenceResult | null> {
  if (!(await hasPersistedSource(sourceId))) {
    return null
  }

  const limit = Math.max(1, Math.min(input.limit ?? 24, 100))

  return withPgClient(async (client) => {
    const rootResult = await client.query<EntityRow>(
      `
        SELECT entity_key, entity_type, canonical_name, slug, document_slug, metadata
        FROM entities
        WHERE source_id = $1
          AND (
            ($2::text IS NOT NULL AND entity_key = $2)
            OR ($3::text IS NOT NULL AND slug = $3)
          )
        ORDER BY
          CASE
            WHEN $2::text IS NOT NULL AND entity_key = $2 THEN 0
            ELSE 1
          END,
          entity_key ASC
        LIMIT 1
      `,
      [sourceId, input.entityKey ?? null, input.slug ?? null],
    )

    const rootRow = rootResult.rows[0]
    if (!rootRow) {
      return null
    }

    const root = mapEntityRow(rootRow, sourceId)
    const relationsResult = await client.query<RelationRow>(
      `
        SELECT
          relation_key,
          relation_type,
          from_entity_key,
          to_entity_key,
          evidence_document_slug,
          weight,
          metadata,
          CASE
            WHEN from_entity_key = $2 THEN 'outgoing'
            ELSE 'incoming'
          END AS direction
        FROM relations
        WHERE source_id = $1
          AND (from_entity_key = $2 OR to_entity_key = $2)
          AND evidence_document_slug IS NOT NULL
        ORDER BY weight DESC, relation_type ASC, relation_key ASC
        LIMIT $3
      `,
      [sourceId, root.entityKey, limit],
    )

    const relations = relationsResult.rows.map((row) => mapRelationRow(row, sourceId))
    const evidenceDocumentSlugs = [...new Set(relations.map((relation) => relation.evidenceDocumentSlug).filter(Boolean))]

    let documents: KnowledgeEvidenceDocument[] = []
    if (evidenceDocumentSlugs.length > 0) {
      const documentsResult = await client.query<DocumentRow>(
        `
          SELECT relative_path, slug, title, content, summary, tags, links, headings, updated_at::text
          FROM documents
          WHERE source_id = $1
            AND slug = ANY($2::text[])
          ORDER BY updated_at DESC, slug ASC
        `,
        [sourceId, evidenceDocumentSlugs],
      )

      documents = documentsResult.rows
        .map((row) => mapDocumentRow(row, sourceId))
        .map((document) => ({
          sourceId,
          slug: document.slug,
          title: document.title,
          summary: document.summary,
          updatedAt: document.updatedAt,
          relationKeys: relations
            .filter((relation) => relation.evidenceDocumentSlug === document.slug)
            .map((relation) => relation.relationKey),
        }))
    }

    return {
      root,
      relations,
      documents,
      summary: {
        relationCount: relations.length,
        evidenceDocumentCount: documents.length,
        incomingCount: relations.filter((relation) => relation.direction === "incoming").length,
        outgoingCount: relations.filter((relation) => relation.direction === "outgoing").length,
      },
    }
  })
}
