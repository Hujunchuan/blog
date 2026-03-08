import {
  KnowledgeEntity,
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
