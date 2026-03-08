import { KnowledgeSnapshot, KnowledgeSource, ParsedKnowledgeDocument, SourceDocument } from "./types"

export interface KnowledgeConnector {
  getSource(): Promise<KnowledgeSource>
  listDocuments(): Promise<SourceDocument[]>
  readDocument(relativePath: string): Promise<string>
}

export interface ParseMarkdownInput {
  source: KnowledgeSource
  document: SourceDocument
  rawContent: string
}

export interface KnowledgeParser {
  parse(input: ParseMarkdownInput): Promise<ParsedKnowledgeDocument>
}

export interface KnowledgeSyncEngine {
  buildSnapshot(source: KnowledgeSource): Promise<KnowledgeSnapshot>
}
