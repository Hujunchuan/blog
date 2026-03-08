import matter from "gray-matter"
import path from "path"
import { KnowledgeParser, ParseMarkdownInput, ParsedKnowledgeDocument } from "../../core/src"

function stripMarkdown(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractTitle(frontmatter: Record<string, unknown>, body: string, relativePath: string) {
  const title = typeof frontmatter.title === "string" ? frontmatter.title.trim() : ""
  if (title) return title

  const headingMatch = body.match(/^#\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim()

  return path.basename(relativePath, path.extname(relativePath))
}

function extractTags(frontmatter: Record<string, unknown>, body: string) {
  const frontmatterTags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter((tag): tag is string => typeof tag === "string")
    : []
  const inlineTags = Array.from(body.matchAll(/(^|\s)#([\p{L}\p{N}_/-]+)/gu)).map((match) => match[2])
  return [...new Set([...frontmatterTags, ...inlineTags])]
}

function extractLinks(body: string) {
  const wikilinks = Array.from(body.matchAll(/\[\[([^[\]|#]+)(?:#[^[\]|]+)?(?:\|[^[\]]+)?\]\]/g)).map(
    (match) => match[1].trim(),
  )

  const markdownLinks = Array.from(body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
    .map((match) => match[1].trim())
    .filter((value) => !value.startsWith("http://") && !value.startsWith("https://") && !value.startsWith("#"))

  return [...new Set([...wikilinks, ...markdownLinks])]
}

function extractHeadings(body: string) {
  return Array.from(body.matchAll(/^#{1,6}\s+(.+)$/gm)).map((match) => match[1].trim())
}

function buildSlug(relativePath: string) {
  return relativePath.replace(/\.(md|mdx)$/i, "").replace(/\\/g, "/")
}

export class MarkdownKnowledgeParser implements KnowledgeParser {
  async parse(input: ParseMarkdownInput): Promise<ParsedKnowledgeDocument> {
    const parsed = matter(input.rawContent)
    const frontmatter = parsed.data && typeof parsed.data === "object" ? parsed.data : {}
    const title = extractTitle(frontmatter as Record<string, unknown>, parsed.content, input.document.relativePath)
    const summary = stripMarkdown(parsed.content).slice(0, 280)

    return {
      sourceId: input.source.id,
      absolutePath: input.document.absolutePath,
      relativePath: input.document.relativePath,
      slug: buildSlug(input.document.relativePath),
      title,
      content: parsed.content.trim(),
      summary,
      tags: extractTags(frontmatter as Record<string, unknown>, parsed.content),
      links: extractLinks(parsed.content),
      headings: extractHeadings(parsed.content),
      updatedAt: input.document.updatedAt,
    }
  }
}
