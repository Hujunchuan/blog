import { promises as fs } from "fs"
import path from "path"
import { KnowledgeConnector, KnowledgeSource, SourceDocument } from "../../core/src"

const DEFAULT_IGNORES = new Set([
  ".git",
  ".obsidian",
  ".next",
  "node_modules",
  "public",
  "dist",
  "build",
])

function toPosixPath(input: string) {
  return input.split(path.sep).join("/")
}

async function walkMarkdownFiles(root: string, current = ""): Promise<SourceDocument[]> {
  const absolute = path.join(root, current)
  const entries = await fs.readdir(absolute, { withFileTypes: true })
  const results: SourceDocument[] = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (DEFAULT_IGNORES.has(entry.name) || entry.name.startsWith(".")) continue
      const nested = await walkMarkdownFiles(root, path.join(current, entry.name))
      results.push(...nested)
      continue
    }

    if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx")) continue

    const relativePath = toPosixPath(path.join(current, entry.name))
    const stat = await fs.stat(path.join(root, relativePath))

    results.push({
      absolutePath: path.join(root, relativePath),
      relativePath,
      updatedAt: stat.mtime.toISOString(),
    })
  }

  return results
}

export class LocalFileConnector implements KnowledgeConnector {
  constructor(private readonly source: KnowledgeSource) {}

  private getIgnoredDirectoryNames() {
    return new Set([
      ...DEFAULT_IGNORES,
      ...(this.source.settings?.ignorePatterns ?? []).filter((pattern) => !pattern.includes("/") && !pattern.includes("*")),
    ])
  }

  private async walk(current = ""): Promise<SourceDocument[]> {
    const absolute = path.join(this.source.location, current)
    const entries = await fs.readdir(absolute, { withFileTypes: true })
    const ignored = this.getIgnoredDirectoryNames()
    const results: SourceDocument[] = []

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (ignored.has(entry.name) || entry.name.startsWith(".")) continue
        const nested = await this.walk(path.join(current, entry.name))
        results.push(...nested)
        continue
      }

      if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx")) continue

      const relativePath = toPosixPath(path.join(current, entry.name))
      const stat = await fs.stat(path.join(this.source.location, relativePath))

      results.push({
        absolutePath: path.join(this.source.location, relativePath),
        relativePath,
        updatedAt: stat.mtime.toISOString(),
      })
    }

    return results
  }

  async getSource(): Promise<KnowledgeSource> {
    return this.source
  }

  async listDocuments(): Promise<SourceDocument[]> {
    return this.walk()
  }

  async readDocument(relativePath: string): Promise<string> {
    const target = path.join(this.source.location, relativePath)
    return fs.readFile(target, "utf8")
  }
}
