import { promises as fs } from "fs"
import path from "path"
import { KnowledgeConnector, KnowledgeSource, SourceDocument } from "../../core/src"
import { scanMarkdownDirectory } from "./filesystemWalker"

export class LocalFileConnector implements KnowledgeConnector {
  constructor(private readonly source: KnowledgeSource) {}

  async getSource(): Promise<KnowledgeSource> {
    return this.source
  }

  async listDocuments(): Promise<SourceDocument[]> {
    return scanMarkdownDirectory(this.source.location, {
      ignorePatterns: this.source.settings?.ignorePatterns,
    })
  }

  async readDocument(relativePath: string): Promise<string> {
    const target = path.join(this.source.location, relativePath)
    return fs.readFile(target, "utf8")
  }
}
