import {
  KnowledgeConnector,
  KnowledgeParser,
  KnowledgeSnapshot,
  KnowledgeSource,
  ParsedKnowledgeDocument,
} from "../../core/src"
import { createGraph, createTree } from "./projections"

function getFolderName(slug: string) {
  const parts = slug.split("/")
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "root"
}

export async function buildKnowledgeSnapshot(
  source: KnowledgeSource,
  connector: KnowledgeConnector,
  parser: KnowledgeParser,
): Promise<KnowledgeSnapshot> {
  const sourceDocuments = await connector.listDocuments()
  const documents = await Promise.all(
    sourceDocuments.map(async (document) =>
      parser.parse({
        source,
        document,
        rawContent: await connector.readDocument(document.relativePath),
      }),
    ),
  )

  const graph = createGraph(documents)
  const tagCounts = new Map<string, number>()
  const documentsWithWeights = new Map<string, number>()

  for (const document of documents) {
    for (const tag of document.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  for (const edge of graph.edges) {
    documentsWithWeights.set(edge.source, (documentsWithWeights.get(edge.source) ?? 0) + 1)
    documentsWithWeights.set(edge.target, (documentsWithWeights.get(edge.target) ?? 0) + 1)
  }

  const folderCount = new Set(documents.map((document) => getFolderName(document.slug))).size

  return {
    source,
    documents: documents.sort((a, b) => a.slug.localeCompare(b.slug, "zh-CN")),
    tree: createTree(documents),
    graph,
    overview: {
      documentCount: documents.length,
      folderCount,
      tagCount: tagCounts.size,
      linkCount: graph.edges.length,
      recentDocuments: [...documents]
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 8)
        .map((document) => ({
          slug: document.slug,
          title: document.title,
          updatedAt: document.updatedAt,
          summary: document.summary,
        })),
      topTags: [...tagCounts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"))
        .slice(0, 12),
      densestDocuments: [...documents]
        .map((document) => ({
          slug: document.slug,
          title: document.title,
          linkCount: documentsWithWeights.get(document.slug) ?? 0,
        }))
        .sort((a, b) => b.linkCount - a.linkCount || a.title.localeCompare(b.title, "zh-CN"))
        .slice(0, 8),
    },
  }
}
