import { promises as fs } from "fs"
import path from "path"
import { SourceDocument } from "../../core/src"

export const DEFAULT_IGNORES = new Set([
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

export function createIgnoredDirectorySet(ignorePatterns: string[] = []) {
  return new Set([
    ...DEFAULT_IGNORES,
    ...ignorePatterns.filter((pattern) => !pattern.includes("/") && !pattern.includes("\\") && !pattern.includes("*")),
  ])
}

export async function scanMarkdownDirectory(
  root: string,
  options: {
    ignorePatterns?: string[]
    current?: string
  } = {},
): Promise<SourceDocument[]> {
  const current = options.current ?? ""
  const ignored = createIgnoredDirectorySet(options.ignorePatterns)
  const absolute = path.join(root, current)
  const entries = await fs.readdir(absolute, { withFileTypes: true })
  const results: SourceDocument[] = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignored.has(entry.name) || entry.name.startsWith(".")) continue
      const nested = await scanMarkdownDirectory(root, {
        ignorePatterns: options.ignorePatterns,
        current: path.join(current, entry.name),
      })
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
