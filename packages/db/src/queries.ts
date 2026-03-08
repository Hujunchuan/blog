import { KnowledgeOverview, ParsedKnowledgeDocument } from "../../core/src"
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

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
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
