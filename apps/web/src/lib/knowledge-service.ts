import { createKnowledgeConnector } from "@repo/connectors/factory"
import {
  getPersistedDocumentBySlug,
  getPersistedExplorerTree,
  getPersistedGraph,
  getPersistedOverview,
  isDatabaseConfigured,
  searchPersistedDocuments,
} from "@repo/db/index"
import { KnowledgeSnapshot, KnowledgeSource, ParsedKnowledgeDocument } from "@repo/core/types"
import { MarkdownKnowledgeParser } from "@repo/parser/markdownParser"
import { buildKnowledgeSnapshot } from "@repo/sync/syncKnowledgeBase"
import { getKnowledgeSourcesConfig, getSnapshotTtlMs } from "./config"
import { MemorySnapshotRepository } from "./memory-snapshot-repository"

const snapshotRepository = new MemorySnapshotRepository(getSnapshotTtlMs())

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function repairMojibakeSegment(value: string) {
  try {
    return Buffer.from(value, "latin1").toString("utf8")
  } catch {
    return value
  }
}

function buildSlugCandidates(slug: string) {
  const candidates = new Set<string>()
  const addCandidate = (value: string) => {
    if (value) {
      candidates.add(value)
    }
  }

  const decoded = slug
    .split("/")
    .map((segment) => safeDecodeSegment(segment))
    .join("/")
  const repaired = slug
    .split("/")
    .map((segment) => repairMojibakeSegment(segment))
    .join("/")
  const decodedAndRepaired = decoded
    .split("/")
    .map((segment) => repairMojibakeSegment(segment))
    .join("/")

  addCandidate(slug)
  addCandidate(decoded)
  addCandidate(repaired)
  addCandidate(decodedAndRepaired)

  return [...candidates]
}

function normalizeSlug(slug: string) {
  return slug
    .split("/")
    .map((segment) => safeDecodeSegment(segment))
    .join("/")
}

async function getSourceOrThrow(sourceId: string): Promise<KnowledgeSource> {
  const source = (await getKnowledgeSourcesConfig()).find((item) => item.id === sourceId && item.enabled)
  if (!source) {
    throw new Error(`Unknown source: ${sourceId}`)
  }
  return source
}

async function buildSnapshotForSource(source: KnowledgeSource) {
  const connector = createKnowledgeConnector(source)
  const parser = new MarkdownKnowledgeParser()
  return buildKnowledgeSnapshot(source, connector, parser)
}

async function tryReadPersisted<T>(callback: () => Promise<T | null>) {
  if (!isDatabaseConfigured()) {
    return undefined
  }

  try {
    return (await callback()) ?? undefined
  } catch {
    return undefined
  }
}

export async function listSources() {
  return (await getKnowledgeSourcesConfig()).filter((source) => source.enabled)
}

export async function getSource(sourceId: string) {
  return getSourceOrThrow(sourceId)
}

export async function getSnapshot(sourceId: string): Promise<KnowledgeSnapshot> {
  const cached = await snapshotRepository.get(sourceId)
  if (cached) {
    return cached
  }

  const snapshot = await buildSnapshotForSource(await getSourceOrThrow(sourceId))
  await snapshotRepository.set(sourceId, snapshot)
  return snapshot
}

export async function getSourceOverview(sourceId: string) {
  const persisted = await tryReadPersisted(() => getPersistedOverview(sourceId))
  if (persisted) {
    return persisted
  }

  return (await getSnapshot(sourceId)).overview
}

export async function getExplorerTree(sourceId: string) {
  const persisted = await tryReadPersisted(() => getPersistedExplorerTree(sourceId))
  if (persisted) {
    return persisted
  }

  return (await getSnapshot(sourceId)).tree
}

export async function getGraph(sourceId: string) {
  const persisted = await tryReadPersisted(() => getPersistedGraph(sourceId))
  if (persisted) {
    return persisted
  }

  return (await getSnapshot(sourceId)).graph
}

export async function searchDocuments(sourceId: string, query: string) {
  const persisted = await tryReadPersisted(() => searchPersistedDocuments(sourceId, query))
  if (persisted) {
    return persisted
  }

  const snapshot = await getSnapshot(sourceId)
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return snapshot.documents.slice(0, 20)
  }

  return snapshot.documents
    .map((document) => {
      let score = 0
      if (document.title.toLowerCase().includes(normalized)) score += 6
      if (document.summary.toLowerCase().includes(normalized)) score += 3
      if (document.content.toLowerCase().includes(normalized)) score += 1
      if (document.tags.some((tag) => tag.toLowerCase().includes(normalized))) score += 4
      return { document, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.document.updatedAt.localeCompare(a.document.updatedAt))
    .slice(0, 30)
    .map((item) => item.document)
}

export async function getDocumentBySlug(sourceId: string, slug: string) {
  const normalizedSlug = normalizeSlug(slug)
  const slugCandidates = buildSlugCandidates(slug)
  if (normalizedSlug !== slug) {
    slugCandidates.push(...buildSlugCandidates(normalizedSlug))
  }

  for (const candidate of [...new Set(slugCandidates)]) {
    const persisted = await tryReadPersisted(() => getPersistedDocumentBySlug(sourceId, candidate))
    if (persisted) {
      return persisted
    }
  }

  return (await getSnapshot(sourceId)).documents.find((document) =>
    [...new Set(slugCandidates)].includes(document.slug),
  )
}

export async function listRecentDocuments(sourceId: string) {
  return (await getSourceOverview(sourceId)).recentDocuments
}

export async function invalidateSnapshot(sourceId?: string) {
  await snapshotRepository.invalidate(sourceId)
}

export function documentUrl(sourceId: string, document: Pick<ParsedKnowledgeDocument, "slug">) {
  const encodedSlug = document.slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `/source/${encodeURIComponent(sourceId)}/doc/${encodedSlug}`
}
