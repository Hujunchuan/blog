import Link from "next/link"
import { notFound } from "next/navigation"
import { ExplorerTree } from "@/components/explorer-tree"
import { StatGrid } from "@/components/stat-grid"
import {
  documentUrl,
  getExplorerTree,
  getGraph,
  getSource,
  getSourceOverview,
  searchDocuments,
} from "@/lib/knowledge-service"

export default async function SourcePage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params

  try {
    const source = await getSource(sourceId)
    const overview = await getSourceOverview(sourceId)
    const tree = await getExplorerTree(sourceId)
    const graph = await getGraph(sourceId)
    const quickResults = await searchDocuments(sourceId, "")

    return (
      <div className="page-stack">
        <section className="hero compact-hero">
          <div>
            <p className="eyebrow">{source.type}</p>
            <h1>{source.name}</h1>
            <p className="lead">{source.description ?? source.location}</p>
          </div>
          <form action={`/source/${sourceId}/search`} className="search-form">
            <input type="search" name="q" placeholder="搜索标题、摘要、标签" />
            <button type="submit">搜索</button>
          </form>
        </section>

        <StatGrid
          items={[
            { label: "文档数", value: overview.documentCount },
            { label: "目录数", value: overview.folderCount },
            { label: "标签数", value: overview.tagCount },
            { label: "链接数", value: overview.linkCount },
          ]}
        />

        <div className="two-column">
          <ExplorerTree sourceId={sourceId} nodes={tree} />

          <div className="page-stack">
            <section className="panel">
              <div className="panel-header">
                <h2>最近更新</h2>
              </div>
              <div className="result-list">
                {overview.recentDocuments.map((document) => (
                  <article key={document.slug} className="result-card">
                    <h3>
                      <Link href={documentUrl(sourceId, document)} prefetch={false}>
                        {document.title}
                      </Link>
                    </h3>
                    <p>{document.summary}</p>
                    <small>{new Date(document.updatedAt).toLocaleString("zh-CN")}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>图谱概览</h2>
                <p>当前优先从 PostgreSQL 读取图谱统计，数据库不可用时自动回退到内存快照。</p>
              </div>
              <StatGrid
                items={[
                  { label: "图谱节点", value: graph.nodes.length },
                  { label: "图谱边", value: graph.edges.length },
                  { label: "快速搜索结果", value: quickResults.length },
                ]}
              />
            </section>
          </div>
        </div>
      </div>
    )
  } catch {
    notFound()
  }
}
