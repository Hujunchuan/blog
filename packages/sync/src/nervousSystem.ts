import {
  ImpactKnowledgeEntity,
  ImpactKnowledgeRelation,
  KnowledgeEntity,
  KnowledgeImpactResult,
  KnowledgeRelation,
  KnowledgeNervousSystemSnapshot,
  ParsedKnowledgeDocument,
} from "../../core/src"
import { resolveInternalTarget } from "./projections"

function normalizeTagKey(tag: string) {
  return encodeURIComponent(tag.trim().replace(/\s+/g, " "))
}

function documentEntityKey(document: ParsedKnowledgeDocument) {
  return `document:${document.slug}`
}

function tagEntityKey(tag: string) {
  return `tag:${normalizeTagKey(tag)}`
}

function relationKey(relationType: KnowledgeRelation["relationType"], fromEntityKey: string, toEntityKey: string) {
  return `${relationType}:${fromEntityKey}->${toEntityKey}`
}

function createDocumentEntity(document: ParsedKnowledgeDocument): KnowledgeEntity {
  return {
    sourceId: document.sourceId,
    entityKey: documentEntityKey(document),
    entityType: "document",
    canonicalName: document.title,
    slug: document.slug,
    documentSlug: document.slug,
    metadata: {
      relativePath: document.relativePath,
      tagCount: document.tags.length,
      linkCount: document.links.length,
    },
  }
}

function createTagEntity(sourceId: string, tag: string): KnowledgeEntity {
  return {
    sourceId,
    entityKey: tagEntityKey(tag),
    entityType: "tag",
    canonicalName: tag,
    metadata: {
      source: "document-tag",
    },
  }
}

export function buildKnowledgeNervousSystem(documents: ParsedKnowledgeDocument[]): KnowledgeNervousSystemSnapshot {
  const entityMap = new Map<string, KnowledgeEntity>()
  const relationMap = new Map<string, KnowledgeRelation>()
  const bySlug = new Map(documents.map((document) => [document.slug, document]))
  const byStem = new Map(documents.map((document) => [document.slug.split("/").at(-1) ?? document.slug, document]))

  const upsertEntity = (entity: KnowledgeEntity) => {
    entityMap.set(entity.entityKey, entity)
  }

  const upsertRelation = (relation: KnowledgeRelation) => {
    relationMap.set(relation.relationKey, relation)
  }

  for (const document of documents) {
    const fromDocumentKey = documentEntityKey(document)
    upsertEntity(createDocumentEntity(document))

    for (const tag of document.tags) {
      const normalizedTag = tag.trim()
      if (!normalizedTag) continue

      const tagKey = tagEntityKey(normalizedTag)
      upsertEntity(createTagEntity(document.sourceId, normalizedTag))
      upsertRelation({
        sourceId: document.sourceId,
        relationKey: relationKey("belongs_to", fromDocumentKey, tagKey),
        relationType: "belongs_to",
        fromEntityKey: fromDocumentKey,
        toEntityKey: tagKey,
        evidenceDocumentSlug: document.slug,
        weight: 1,
        metadata: {
          source: "tag",
        },
      })
    }

    for (const rawTarget of document.links) {
      const target = resolveInternalTarget(document, rawTarget, bySlug, byStem)
      if (!target || target.slug === document.slug) continue

      upsertEntity(createDocumentEntity(target))
      upsertRelation({
        sourceId: document.sourceId,
        relationKey: relationKey("references", fromDocumentKey, documentEntityKey(target)),
        relationType: "references",
        fromEntityKey: fromDocumentKey,
        toEntityKey: documentEntityKey(target),
        evidenceDocumentSlug: document.slug,
        weight: 1,
        metadata: {
          rawTarget,
          source: "link",
        },
      })
    }
  }

  return {
    entities: [...entityMap.values()].sort((a, b) => a.entityKey.localeCompare(b.entityKey, "en")),
    relations: [...relationMap.values()].sort((a, b) => a.relationKey.localeCompare(b.relationKey, "en")),
  }
}

export function buildKnowledgeImpact(
  nervousSystem: KnowledgeNervousSystemSnapshot,
  rootEntityKey: string,
  options?: { depth?: number; limit?: number },
): KnowledgeImpactResult | null {
  const root = nervousSystem.entities.find((entity) => entity.entityKey === rootEntityKey)
  if (!root) {
    return null
  }

  const maxDepth = Math.max(1, Math.min(options?.depth ?? 2, 6))
  const maxRelations = Math.max(1, Math.min(options?.limit ?? 40, 200))
  const adjacency = new Map<
    string,
    Array<{
      relation: KnowledgeRelation
      nextEntityKey: string
      direction: ImpactKnowledgeRelation["direction"]
    }>
  >()

  for (const relation of nervousSystem.relations) {
    const outgoingEntries = adjacency.get(relation.fromEntityKey) ?? []
    outgoingEntries.push({
      relation,
      nextEntityKey: relation.toEntityKey,
      direction: "outgoing",
    })
    adjacency.set(relation.fromEntityKey, outgoingEntries)

    const incomingEntries = adjacency.get(relation.toEntityKey) ?? []
    incomingEntries.push({
      relation,
      nextEntityKey: relation.fromEntityKey,
      direction: "incoming",
    })
    adjacency.set(relation.toEntityKey, incomingEntries)
  }

  const visitedDepth = new Map<string, number>([[root.entityKey, 0]])
  const impactRelations = new Map<string, ImpactKnowledgeRelation>()
  const queue: Array<{ entityKey: string; depth: number }> = [{ entityKey: root.entityKey, depth: 0 }]

  while (queue.length > 0 && impactRelations.size < maxRelations) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) {
      continue
    }

    const entries = [...(adjacency.get(current.entityKey) ?? [])].sort(
      (a, b) =>
        (b.relation.weight ?? 1) - (a.relation.weight ?? 1) ||
        a.relation.relationType.localeCompare(b.relation.relationType, "en") ||
        a.relation.relationKey.localeCompare(b.relation.relationKey, "en"),
    )

    for (const entry of entries) {
      const nextDepth = current.depth + 1
      const relationKey = `${entry.relation.relationKey}:${entry.direction}:${nextDepth}`

      if (impactRelations.size < maxRelations && !impactRelations.has(relationKey)) {
        impactRelations.set(relationKey, {
          ...entry.relation,
          direction: entry.direction,
          depth: nextDepth,
        })
      }

      const knownDepth = visitedDepth.get(entry.nextEntityKey)
      if (knownDepth === undefined || nextDepth < knownDepth) {
        visitedDepth.set(entry.nextEntityKey, nextDepth)
        if (nextDepth < maxDepth && impactRelations.size < maxRelations) {
          queue.push({ entityKey: entry.nextEntityKey, depth: nextDepth })
        }
      }
    }
  }

  const entityMap = new Map(nervousSystem.entities.map((entity) => [entity.entityKey, entity]))
  const entities: ImpactKnowledgeEntity[] = [...visitedDepth.entries()]
    .map(([entityKey, depth]) => {
      const entity = entityMap.get(entityKey)
      if (!entity) {
        return undefined
      }

      return {
        ...entity,
        depth,
      }
    })
    .filter((entity): entity is ImpactKnowledgeEntity => Boolean(entity))
    .sort(
      (a, b) =>
        a.depth - b.depth ||
        a.entityType.localeCompare(b.entityType, "en") ||
        a.canonicalName.localeCompare(b.canonicalName, "zh-CN"),
    )

  const relations = [...impactRelations.values()].sort(
    (a, b) =>
      a.depth - b.depth ||
      a.direction.localeCompare(b.direction, "en") ||
      a.relationType.localeCompare(b.relationType, "en") ||
      a.relationKey.localeCompare(b.relationKey, "en"),
  )

  return {
    root,
    entities,
    relations,
    summary: {
      maxDepth,
      entityCount: entities.length,
      relationCount: relations.length,
      incomingCount: relations.filter((relation) => relation.direction === "incoming").length,
      outgoingCount: relations.filter((relation) => relation.direction === "outgoing").length,
    },
  }
}
