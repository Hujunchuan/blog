import { createKnowledgeConnector } from "@repo/connectors/factory"
import {
  getPersistedDocumentBySlug,
  getPersistedEvidence,
  getPersistedExplorerTree,
  getPersistedGraph,
  getPersistedImpact,
  getPersistedOverview,
  getPersistedRelated,
  isDatabaseConfigured,
  searchPersistedDocuments,
} from "@repo/db/index"
import {
  KnowledgeEvidenceDocument,
  KnowledgeEvidenceResult,
  KnowledgeGraphMode,
  KnowledgeImpactResult,
  KnowledgeRelatedResult,
  KnowledgeSnapshot,
  KnowledgeSource,
  ParsedKnowledgeDocument,
} from "@repo/core/types"
import { MarkdownKnowledgeParser } from "@repo/parser/markdownParser"
import { buildKnowledgeImpact, buildKnowledgeNervousSystem } from "@repo/sync/nervousSystem"
import { createKnowledgeGraph } from "@repo/sync/projections"
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

export async function getGraph(sourceId: string, mode: KnowledgeGraphMode = "documents") {
  const persisted = await tryReadPersisted(() => getPersistedGraph(sourceId, mode))
  if (persisted) {
    return persisted
  }

  const snapshot = await getSnapshot(sourceId)
  if (mode === "knowledge") {
    return createKnowledgeGraph(buildKnowledgeNervousSystem(snapshot.documents))
  }

  return snapshot.graph
}

export async function getRelatedKnowledge(
  sourceId: string,
  input: { entityKey?: string; slug?: string; limit?: number },
): Promise<KnowledgeRelatedResult | null> {
  const slugCandidates = input.slug ? [...new Set(buildSlugCandidates(input.slug))] : []

  if (input.entityKey) {
    const persisted = await tryReadPersisted(() =>
      getPersistedRelated(sourceId, {
        entityKey: input.entityKey,
        limit: input.limit,
      }),
    )
    if (persisted) {
      return persisted
    }
  }

  for (const candidate of slugCandidates) {
    const persisted = await tryReadPersisted(() =>
      getPersistedRelated(sourceId, {
        slug: candidate,
        limit: input.limit,
      }),
    )
    if (persisted) {
      return persisted
    }
  }

  const nervousSystem = buildKnowledgeNervousSystem((await getSnapshot(sourceId)).documents)
  const root =
    nervousSystem.entities.find((entity) => input.entityKey && entity.entityKey === input.entityKey) ??
    nervousSystem.entities.find((entity) => entity.slug && slugCandidates.includes(entity.slug))

  if (!root) {
    return null
  }

  const relations = nervousSystem.relations
    .filter((relation) => relation.fromEntityKey === root.entityKey || relation.toEntityKey === root.entityKey)
    .slice(0, Math.max(1, Math.min(input.limit ?? 24, 100)))
    .map((relation) => ({
      ...relation,
      direction: relation.fromEntityKey === root.entityKey ? ("outgoing" as const) : ("incoming" as const),
    }))

  const entityKeys = new Set([root.entityKey, ...relations.flatMap((relation) => [relation.fromEntityKey, relation.toEntityKey])])

  return {
    root,
    entities: nervousSystem.entities.filter((entity) => entityKeys.has(entity.entityKey)),
    relations,
  }
}

export async function getKnowledgeImpact(
  sourceId: string,
  input: { entityKey?: string; slug?: string; depth?: number; limit?: number },
): Promise<KnowledgeImpactResult | null> {
  const slugCandidates = input.slug ? [...new Set(buildSlugCandidates(input.slug))] : []

  if (input.entityKey) {
    const persisted = await tryReadPersisted(() =>
      getPersistedImpact(sourceId, {
        entityKey: input.entityKey,
        depth: input.depth,
        limit: input.limit,
      }),
    )
    if (persisted) {
      return persisted
    }
  }

  for (const candidate of slugCandidates) {
    const persisted = await tryReadPersisted(() =>
      getPersistedImpact(sourceId, {
        slug: candidate,
        depth: input.depth,
        limit: input.limit,
      }),
    )
    if (persisted) {
      return persisted
    }
  }

  const nervousSystem = buildKnowledgeNervousSystem((await getSnapshot(sourceId)).documents)
  const root =
    nervousSystem.entities.find((entity) => input.entityKey && entity.entityKey === input.entityKey) ??
    nervousSystem.entities.find((entity) => entity.slug && slugCandidates.includes(entity.slug))

  if (!root) {
    return null
  }

  return buildKnowledgeImpact(nervousSystem, root.entityKey, {
    depth: input.depth,
    limit: input.limit,
  })
}

export async function getKnowledgeEvidence(
  sourceId: string,
  input: { entityKey?: string; slug?: string; limit?: number },
): Promise<KnowledgeEvidenceResult | null> {
  const slugCandidates = input.slug ? [...new Set(buildSlugCandidates(input.slug))] : []

  if (input.entityKey) {
    const persisted = await tryReadPersisted(() =>
      getPersistedEvidence(sourceId, {
        entityKey: input.entityKey,
        limit: input.limit,
      }),
    )
    if (persisted) {
      return persisted
    }
  }

  for (const candidate of slugCandidates) {
    const persisted = await tryReadPersisted(() =>
      getPersistedEvidence(sourceId, {
        slug: candidate,
        limit: input.limit,
      }),
    )
    if (persisted) {
      return persisted
    }
  }

  const snapshot = await getSnapshot(sourceId)
  const nervousSystem = buildKnowledgeNervousSystem(snapshot.documents)
  const root =
    nervousSystem.entities.find((entity) => input.entityKey && entity.entityKey === input.entityKey) ??
    nervousSystem.entities.find((entity) => entity.slug && slugCandidates.includes(entity.slug))

  if (!root) {
    return null
  }

  const relations = nervousSystem.relations
    .filter(
      (relation) =>
        (relation.fromEntityKey === root.entityKey || relation.toEntityKey === root.entityKey) &&
        Boolean(relation.evidenceDocumentSlug),
    )
    .slice(0, Math.max(1, Math.min(input.limit ?? 24, 100)))
    .map((relation) => ({
      ...relation,
      direction: relation.fromEntityKey === root.entityKey ? ("outgoing" as const) : ("incoming" as const),
    }))

  const documentsBySlug = new Map(snapshot.documents.map((document) => [document.slug, document]))
  const evidenceDocumentSlugs = [
    ...new Set(
      relations
        .map((relation) => relation.evidenceDocumentSlug)
        .filter((slug): slug is string => typeof slug === "string" && slug.length > 0),
    ),
  ]
  const documents: KnowledgeEvidenceDocument[] = evidenceDocumentSlugs
    .map((slug) => documentsBySlug.get(slug))
    .filter((document): document is ParsedKnowledgeDocument => Boolean(document))
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

export function tagEntityKey(tag: string) {
  return `tag:${encodeURIComponent(tag.trim().replace(/\s+/g, " "))}`
}

export function knowledgeAnalysisUrl(
  sourceId: string,
  input: { slug?: string; entityKey?: string; depth?: number; limit?: number },
) {
  const params = new URLSearchParams()
  if (input.slug) {
    params.set("slug", input.slug)
  }
  if (input.entityKey) {
    params.set("entityKey", input.entityKey)
  }
  if (typeof input.depth === "number") {
    params.set("depth", String(input.depth))
  }
  if (typeof input.limit === "number") {
    params.set("limit", String(input.limit))
  }

  const query = params.toString()
  return `/source/${encodeURIComponent(sourceId)}/knowledge${query ? `?${query}` : ""}`
}

export function graphUrl(
  sourceId: string,
  input: { mode?: KnowledgeGraphMode; focus?: string } = {},
) {
  const params = new URLSearchParams()
  if (input.mode) {
    params.set("mode", input.mode)
  }
  if (input.focus) {
    params.set("focus", input.focus)
  }

  const query = params.toString()
  return `/source/${encodeURIComponent(sourceId)}/graph${query ? `?${query}` : ""}`
}
