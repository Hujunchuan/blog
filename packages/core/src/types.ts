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

export interface ExplorerNode {
  id: string
  name: string
  path: string
  isFolder: boolean
  slug?: string
  children?: ExplorerNode[]
}

export interface KnowledgeGraphNode {
  id: string
  label: string
  slug: string
  group: string
  weight: number
}

export interface KnowledgeGraphEdge {
  source: string
  target: string
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
