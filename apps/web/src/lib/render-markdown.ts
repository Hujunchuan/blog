import path from "path"
import GithubSlugger from "github-slugger"
import { toHtml } from "hast-util-to-html"
import { toString } from "hast-util-to-string"
import rehypeRaw from "rehype-raw"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { visit } from "unist-util-visit"

const externalHrefPattern = /^(https?:|mailto:|tel:)/i

function encodeSlug(slug: string) {
  return slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function replaceWikiLinks(content: string) {
  return content.replace(/\[\[([^[\]|#]+)(?:#([^[\]|]+))?(?:\|([^[\]]+))?\]\]/g, (_, rawTarget, rawAnchor, rawLabel) => {
    const target = String(rawTarget ?? "").trim()
    const anchor = String(rawAnchor ?? "").trim()
    const label = String(rawLabel ?? "").trim() || target
    const href = `obsidian:${target}${anchor ? `#${anchor}` : ""}`
    return `[${label}](${href})`
  })
}

function normalizeContentLink(target: string, currentSlug: string) {
  const [rawPath, rawHash] = target.split("#")
  const cleanTarget = rawPath.trim().replace(/\\/g, "/")
  const normalizedTarget = cleanTarget.replace(/^obsidian:/, "")

  let resolvedPath = normalizedTarget
  if (normalizedTarget.startsWith("/")) {
    resolvedPath = normalizedTarget.slice(1)
  } else if (normalizedTarget.startsWith("./") || normalizedTarget.startsWith("../")) {
    resolvedPath = path.posix.normalize(path.posix.join(path.posix.dirname(currentSlug), normalizedTarget))
  }

  resolvedPath = resolvedPath.replace(/\.(md|mdx)$/i, "").replace(/^\/+/, "")
  const hash = rawHash?.trim()

  return {
    slug: resolvedPath,
    hash: hash ? `#${encodeURIComponent(hash)}` : "",
  }
}

function rehypeKnowledgeDocument(sourceId: string, currentSlug: string) {
  return () => {
    return (tree: unknown) => {
      const slugger = new GithubSlugger()

      visit(tree, "element", (node: any) => {
        if (typeof node?.tagName !== "string") {
          return
        }

        if (/^h[1-6]$/.test(node.tagName)) {
          const text = toString(node).trim()
          if (text) {
            node.properties = {
              ...(node.properties ?? {}),
              id: slugger.slug(text),
            }
          }
        }

        if (node.tagName === "a" && typeof node.properties?.href === "string") {
          const href = node.properties.href.trim()
          if (!href || href.startsWith("#")) {
            return
          }

          if (externalHrefPattern.test(href)) {
            node.properties = {
              ...(node.properties ?? {}),
              target: "_blank",
              rel: "noreferrer",
            }
            return
          }

          const resolved = normalizeContentLink(href, currentSlug)
          node.properties = {
            ...(node.properties ?? {}),
            href: `/source/${encodeURIComponent(sourceId)}/doc/${encodeSlug(resolved.slug)}${resolved.hash}`,
          }
          return
        }

        if (node.tagName === "img") {
          node.properties = {
            ...(node.properties ?? {}),
            loading: "lazy",
          }
        }
      })
    }
  }
}

export async function renderKnowledgeMarkdown(input: {
  sourceId: string
  slug: string
  content: string
}) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKnowledgeDocument(input.sourceId, input.slug))

  const tree = await processor.run(processor.parse(replaceWikiLinks(input.content)))
  return toHtml(tree as any)
}

export function buildHeadingAnchors(headings: string[]) {
  const slugger = new GithubSlugger()
  return headings.map((text) => ({
    text,
    id: slugger.slug(text),
  }))
}
