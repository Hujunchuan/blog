import Link from "next/link"
import { notFound } from "next/navigation"
import { KnowledgeGraphMode } from "@repo/core/types"
import { KnowledgeGraphView } from "@/components/knowledge-graph-view"
import { StatGrid } from "@/components/stat-grid"
import {
  getGraph,
  getSource,
  getSourceOverview,
  graphUrl,
  knowledgeAnalysisUrl,
  tagEntityKey,
} from "@/lib/knowledge-service"

export const dynamic = "force-dynamic"

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function GraphPage({
  params,
  searchParams,
}: {
  params: Promise<{ sourceId: string }>
  searchParams: Promise<{
    mode?: string | string[]
    focus?: string | string[]
  }>
}) {
  const { sourceId } = await params
  const resolvedSearchParams = await searchParams
  const mode: KnowledgeGraphMode = firstValue(resolvedSearchParams.mode) === "knowledge" ? "knowledge" : "documents"
  const focus = firstValue(resolvedSearchParams.focus)

  let source: Awaited<ReturnType<typeof getSource>>
  try {
    source = await getSource(sourceId)
  } catch {
    notFound()
  }

  const [overview, graph] = await Promise.all([getSourceOverview(sourceId), getGraph(sourceId, mode)])
  const groupCount = new Set(graph.nodes.map((node) => node.group)).size
  const defaultKnowledgeFocus = overview.topTags[0] ? tagEntityKey(overview.topTags[0].tag) : undefined
  const defaultDocumentFocus = overview.recentDocuments[0]?.slug

  return (
    <div className="page-stack">
      <section className="hero compact-hero">
        <div>
          <p className="eyebrow">graph view</p>
          <h1>{mode === "knowledge" ? "知识节点图谱" : "文档链接图谱"}</h1>
          <p className="lead">
            {mode === "knowledge"
              ? "基于 nervous system 的 entities / relations 浏览知识节点、标签和文档之间的结构关系。"
              : "基于文档内部链接浏览当前知识源的目录群落与引用网络。"}
          </p>
          <div className="action-row">
            <Link href={`/source/${encodeURIComponent(sourceId)}`} className="ghost-link" prefetch={false}>
              {`返回 ${source.name}`}
            </Link>
            <Link href={graphUrl(sourceId, { mode: "documents" })} className="ghost-link" prefetch={false}>
              文档模式
            </Link>
            <Link href={graphUrl(sourceId, { mode: "knowledge" })} className="ghost-link" prefetch={false}>
              知识模式
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <span>当前模式</span>
          <strong>{mode === "knowledge" ? "knowledge graph" : "document graph"}</strong>
          <span>{`节点 ${graph.nodes.length} / 边 ${graph.edges.length} / 分组 ${groupCount}`}</span>
        </div>
      </section>

      <StatGrid
        items={[
          { label: "图谱节点", value: graph.nodes.length },
          { label: "图谱边", value: graph.edges.length },
          { label: "分组数", value: groupCount },
          { label: "最近文档", value: overview.recentDocuments.length },
        ]}
      />

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>图谱浏览</h2>
            <p>支持搜索、节点聚焦和从图谱直接跳转到文档或知识分析。</p>
          </div>
        </div>
        <KnowledgeGraphView sourceId={sourceId} mode={mode} graph={graph} initialFocus={focus} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>快速入口</h2>
            <p>{mode === "knowledge" ? "从高频标签进入知识节点图谱。" : "从最近更新文档进入文档图谱。"}</p>
          </div>
        </div>
        <div className="tag-row">
          {mode === "knowledge"
            ? overview.topTags.slice(0, 10).map((tag) => (
                <Link
                  key={tag.tag}
                  href={graphUrl(sourceId, { mode: "knowledge", focus: tagEntityKey(tag.tag) })}
                  className="tag-chip"
                  prefetch={false}
                >
                  {`#${tag.tag}`}
                </Link>
              ))
            : overview.recentDocuments.slice(0, 10).map((document) => (
                <Link
                  key={document.slug}
                  href={graphUrl(sourceId, { mode: "documents", focus: document.slug })}
                  className="tag-chip"
                  prefetch={false}
                >
                  {document.title}
                </Link>
              ))}
        </div>
        <div className="action-row">
          <Link
            href={knowledgeAnalysisUrl(sourceId, {
              entityKey: defaultKnowledgeFocus,
              slug: mode === "documents" ? defaultDocumentFocus : undefined,
            })}
            className="ghost-link"
            prefetch={false}
          >
            打开知识分析
          </Link>
        </div>
      </section>
    </div>
  )
}
