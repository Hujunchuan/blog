import { KnowledgeSnapshot, KnowledgeSource } from "../../core/src"
import { withPgClient } from "./client"
import { replaceDocumentsForSource } from "./document-store"
import { initialSchemaSql } from "./schema"
import { upsertSource } from "./source-store"
import { finishSyncRun, startSyncRun } from "./sync-run-store"

export async function initializeDatabaseSchema() {
  await withPgClient(async (client) => {
    for (const statement of initialSchemaSql) {
      await client.query(statement)
    }
  })
}

export async function persistSourceSnapshot(source: KnowledgeSource, snapshot: KnowledgeSnapshot) {
  return withPgClient(async (client) => {
    await client.query("BEGIN")
    let syncRunId: string | undefined

    try {
      for (const statement of initialSchemaSql) {
        await client.query(statement)
      }

      await upsertSource(client, source)
      syncRunId = await startSyncRun(client, source.id)
      await replaceDocumentsForSource(client, source.id, snapshot.documents)
      await finishSyncRun(client, syncRunId, {
        status: "success",
        stats: {
          documentCount: snapshot.documents.length,
          folderCount: snapshot.overview.folderCount,
          tagCount: snapshot.overview.tagCount,
          linkCount: snapshot.overview.linkCount,
        },
      })
      await client.query("COMMIT")

      return {
        status: "ok" as const,
        sourceId: source.id,
        syncRunId,
        documentCount: snapshot.documents.length,
      }
    } catch (error) {
      await client.query("ROLLBACK")

      if (syncRunId) {
        await finishSyncRun(client, syncRunId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown persistence error",
        })
      }

      throw error
    }
  })
}
