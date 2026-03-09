import Link from "next/link"
import { notFound } from "next/navigation"
import { KnowledgeGraphMode } from "@repo/core/types"
import { GraphViewShell } from "@/components/graph-view-shell"
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
  const relationTypeCount = new Set(graph.edges.flatMap((edge) => edge.relationTypes ?? ["references"])).size
  const defaultKnowledgeFocus = overview.topTags[0] ? tagEntityKey(overview.topTags[0].tag) : undefined
  const defaultDocumentFocus = overview.recentDocuments[0]?.slug

  return (
    <div className="page-stack">
      <section className="quartz-page-header">
        <p className="eyebrow">图谱视图</p>
        <h1>{mode === "knowledge" ? "知识节点图谱" : "文档链接图谱"}</h1>
        <p className="lead">
          {mode === "knowledge"
            ? "基于 nervous system 的 entities / relations 查看概念、人物、项目、标签与文档之间的结构关系。"
            : "基于文档内部链接查看当前知识源的目录结构、互引关系和局部连接密度。"}
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
          <Link
            href={knowledgeAnalysisUrl(sourceId, {
              entityKey: mode === "knowledge" ? defaultKnowledgeFocus : undefined,
              slug: mode === "documents" ? defaultDocumentFocus : undefined,
            })}
            className="ghost-link"
            prefetch={false}
          >
            打开知识分析
          </Link>
        </div>
      </section>

      <div className="quartz-page-grid">
        <aside className="quartz-side-column">
          <section className="panel side-panel">
            <div className="panel-header">
              <div>
                <h2>图谱概况</h2>
                <p>当前页面采用左侧信息栏、中间图谱、右侧节点详情的三栏结构，便于持续浏览和定位。</p>
              </div>
            </div>
            <div className="result-list">
              <div className="result-card">
                <h3>当前模式</h3>
                <p>{mode === "knowledge" ? "知识图谱" : "文档图谱"}</p>
                <div className="badge-row">
                  <span className="badge">{`节点 ${graph.nodes.length}`}</span>
                  <span className="badge">{`边 ${graph.edges.length}`}</span>
                  <span className="badge">{`分组 ${groupCount}`}</span>
                  <span className="badge">{`关系类型 ${relationTypeCount}`}</span>
                </div>
              </div>
              <div className="result-card">
                <h3>数据来源</h3>
                <p>{source.description ?? source.location}</p>
                <small>{source.location}</small>
              </div>
            </div>
          </section>

          <section className="panel side-panel">
            <div className="panel-header">
              <div>
                <h2>快速定位</h2>
                <p>{mode === "knowledge" ? "优先从高频标签切入知识图谱。" : "优先从最近更新文档切入文档图谱。"}</p>
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
          </section>
        </aside>

        <section className="quartz-main-column">
          <GraphViewShell sourceId={sourceId} mode={mode} graph={graph} initialFocus={focus} />
        </section>
      </div>
    </div>
  )
}
