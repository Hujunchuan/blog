import { createHash } from "crypto"
import { PoolClient } from "pg"
import { ParsedKnowledgeDocument } from "../../core/src"

function hashDocument(document: ParsedKnowledgeDocument) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        relativePath: document.relativePath,
        title: document.title,
        content: document.content,
        summary: document.summary,
        tags: document.tags,
        links: document.links,
        headings: document.headings,
        updatedAt: document.updatedAt,
      }),
    )
    .digest("hex")
}

export async function replaceDocumentsForSource(
  client: PoolClient,
  sourceId: string,
  documents: ParsedKnowledgeDocument[],
) {
  await client.query(`DELETE FROM documents WHERE source_id = $1`, [sourceId])

  for (const document of documents) {
    await client.query(
      `
        INSERT INTO documents (
          source_id,
          relative_path,
          slug,
          title,
          content,
          summary,
          tags,
          links,
          headings,
          updated_at,
          content_hash,
          indexed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, NOW())
      `,
      [
        sourceId,
        document.relativePath,
        document.slug,
        document.title,
        document.content,
        document.summary,
        JSON.stringify(document.tags),
        JSON.stringify(document.links),
        JSON.stringify(document.headings),
        document.updatedAt,
        hashDocument(document),
      ],
    )
  }
}
