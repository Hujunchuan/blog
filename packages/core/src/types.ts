export type SourceType = "local" | "github" | "server"

export interface KnowledgeSource {
  id: string
  name: string
  type: SourceType
  location: string
  enabled: boolean
  description?: string
  settings?: {
    ignorePatterns?: string[]
  }
}

export interface SourceDocument {
  absolutePath: string
  relativePath: string
  updatedAt: string
}

export interface ParsedKnowledgeDocument {
  sourceId: string
  absolutePath: string
  relativePath: string
  slug: string
  title: string
  content: string
  summary: string
  tags: string[]
  links: string[]
  headings: string[]
  updatedAt: string
}

export type KnowledgeEntityType =
  | "document"
  | "concept"
  | "person"
  | "project"
  | "meeting"
  | "decision"
  | "task"
  | "practice"
  | "tag"

export type KnowledgeRelationType =
  | "mentions"
  | "references"
  | "explains"
  | "belongs_to"
  | "derived_from"
  | "decides"
  | "supports"
  | "contradicts"
  | "related_to"
  | "next_step_for"

export interface KnowledgeEntity {
  sourceId: string
  entityKey: string
  entityType: KnowledgeEntityType
  canonicalName: string
  slug?: string
  documentSlug?: string
  metadata?: Record<string, unknown>
}

export interface KnowledgeRelation {
  sourceId: string
  relationKey: string
  relationType: KnowledgeRelationType
  fromEntityKey: string
  toEntityKey: string
  evidenceDocumentSlug?: string
  weight?: number
  metadata?: Record<string, unknown>
}

export interface KnowledgeNervousSystemSnapshot {
  entities: KnowledgeEntity[]
  relations: KnowledgeRelation[]
}

export interface RelatedKnowledgeRelation extends KnowledgeRelation {
  direction: "incoming" | "outgoing"
}

export interface KnowledgeRelatedResult {
  root: KnowledgeEntity
  entities: KnowledgeEntity[]
  relations: RelatedKnowledgeRelation[]
}

export interface ImpactKnowledgeEntity extends KnowledgeEntity {
  depth: number
}

export interface ImpactKnowledgeRelation extends KnowledgeRelation {
  direction: "incoming" | "outgoing"
  depth: number
}

export interface KnowledgeImpactResult {
  root: KnowledgeEntity
  entities: ImpactKnowledgeEntity[]
  relations: ImpactKnowledgeRelation[]
  summary: {
    maxDepth: number
    entityCount: number
    relationCount: number
    incomingCount: number
    outgoingCount: number
  }
}

export interface KnowledgeEvidenceDocument {
  sourceId: string
  slug: string
  title: string
  summary: string
  updatedAt: string
  relationKeys: string[]
}

export interface KnowledgeEvidenceResult {
  root: KnowledgeEntity
  relations: RelatedKnowledgeRelation[]
  documents: KnowledgeEvidenceDocument[]
  summary: {
    relationCount: number
    evidenceDocumentCount: number
    incomingCount: number
    outgoingCount: number
  }
}

export interface ExplorerNode {
  id: string
  name: string
  path: string
  isFolder: boolean
  slug?: string
  children?: ExplorerNode[]
}

export type KnowledgeGraphMode = "documents" | "knowledge"

export interface KnowledgeGraphNode {
  id: string
  label: string
  slug?: string
  entityKey?: string
  group: string
  weight: number
}

export interface KnowledgeGraphEdge {
  source: string
  target: string
  relationTypes?: KnowledgeRelationType[]
  evidenceDocumentSlugs?: string[]
  weight?: number
}

export interface KnowledgeOverview {
  documentCount: number
  folderCount: number
  tagCount: number
  linkCount: number
  recentDocuments: Array<Pick<ParsedKnowledgeDocument, "slug" | "title" | "updatedAt" | "summary">>
  topTags: Array<{ tag: string; count: number }>
  densestDocuments: Array<{ slug: string; title: string; linkCount: number }>
}

export interface KnowledgeSnapshot {
  source: KnowledgeSource
  documents: ParsedKnowledgeDocument[]
  tree: ExplorerNode[]
  graph: {
    nodes: KnowledgeGraphNode[]
    edges: KnowledgeGraphEdge[]
  }
  overview: KnowledgeOverview
}
