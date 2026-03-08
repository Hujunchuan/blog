import path from "path"
import { ExplorerNode, KnowledgeGraphEdge, KnowledgeGraphNode, ParsedKnowledgeDocument } from "../../core/src"

function getFolderName(slug: string) {
  const parts = slug.split("/")
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "root"
}

export function createTree(documents: ParsedKnowledgeDocument[]) {
  const treeRoot: ExplorerNode = {
    id: "root",
    name: "root",
    path: "",
    isFolder: true,
    children: [],
  }

  for (const document of documents) {
    const parts = document.slug.split("/")
    const folders = parts.slice(0, -1)

    let branch = treeRoot
    let branchPath = ""
    for (const folder of folders) {
      branchPath = branchPath ? `${branchPath}/${folder}` : folder
      let folderNode = branch.children?.find((node) => node.path === branchPath && node.isFolder)
      if (!folderNode) {
        folderNode = {
          id: branchPath,
          name: folder,
          path: branchPath,
          isFolder: true,
          children: [],
        }
        branch.children = [...(branch.children ?? []), folderNode]
      }
      branch = folderNode
    }

    branch.children = [
      ...(branch.children ?? []),
      {
        id: document.slug,
        name: path.basename(document.slug),
        path: document.slug,
        slug: document.slug,
        isFolder: false,
      },
    ]
  }

  const sortNodes = (nodes: ExplorerNode[] = []): ExplorerNode[] =>
    nodes
      .sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1
        if (!a.isFolder && b.isFolder) return 1
        return a.name.localeCompare(b.name, "zh-CN")
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }))

  return sortNodes(treeRoot.children)
}

export function resolveInternalTarget(
  document: ParsedKnowledgeDocument,
  target: string,
  bySlug: Map<string, ParsedKnowledgeDocument>,
  byStem: Map<string, ParsedKnowledgeDocument>,
) {
  const normalized = target
    .replace(/\\/g, "/")
    .replace(/\.(md|mdx)$/i, "")
    .replace(/^\.\//, "")

  if (bySlug.has(normalized)) return bySlug.get(normalized)!
  const currentFolder = getFolderName(document.slug)
  const joined = currentFolder === "root" ? normalized : `${currentFolder}/${normalized}`
  if (bySlug.has(joined)) return bySlug.get(joined)!
  if (byStem.has(normalized)) return byStem.get(normalized)!
  return undefined
}

export function createGraph(documents: ParsedKnowledgeDocument[]) {
  const bySlug = new Map(documents.map((document) => [document.slug, document]))
  const byStem = new Map(documents.map((document) => [path.basename(document.slug), document]))
  const edgeSet = new Set<string>()
  const edges: KnowledgeGraphEdge[] = []
  const weights = new Map<string, number>()

  for (const document of documents) {
    for (const rawTarget of document.links) {
      const target = resolveInternalTarget(document, rawTarget, bySlug, byStem)
      if (!target || target.slug === document.slug) continue

      const key = `${document.slug}->${target.slug}`
      if (edgeSet.has(key)) continue

      edgeSet.add(key)
      edges.push({ source: document.slug, target: target.slug })
      weights.set(document.slug, (weights.get(document.slug) ?? 0) + 1)
      weights.set(target.slug, (weights.get(target.slug) ?? 0) + 1)
    }
  }

  const nodes: KnowledgeGraphNode[] = documents.map((document) => ({
    id: document.slug,
    label: document.title,
    slug: document.slug,
    group: getFolderName(document.slug),
    weight: weights.get(document.slug) ?? 0,
  }))

  return { nodes, edges }
}
