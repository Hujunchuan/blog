import Link from "next/link"
import { getSourceOverview, listSources } from "@/lib/knowledge-service"
import { StatGrid } from "@/components/stat-grid"

export const dynamic = "force-dynamic"

type SourceCard = {
  source: Awaited<ReturnType<typeof listSources>>[number]
  overview:
    | {
        documentCount: number
        folderCount: number
        tagCount: number
      }
    | null
  error?: string
}

export default async function HomePage() {
  const sources = await listSources()
  const cards: SourceCard[] = await Promise.all(
    sources.map(async (source) => {
      try {
        const overview = await getSourceOverview(source.id)
        return {
          source,
          overview: {
            documentCount: overview.documentCount,
            folderCount: overview.folderCount,
            tagCount: overview.tagCount,
          },
        }
      } catch (error) {
        return {
          source,
          overview: null,
          error: error instanceof Error ? error.message : "未知知识源读取错误",
        }
      }
    }),
  )

  const availableCards = cards.filter((card) => card.overview)

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <p className="eyebrow">止观AI</p>
          <h1>止观AI 知识平台</h1>
          <p className="lead">
            当前版本支持本地知识源与 GitHub 知识源，并通过 Next.js 动态读取内容。概览、搜索、知识图谱与分析页已经接入数据库优先读取链路，同时保留快照回退能力。
          </p>
        </div>
        <div className="hero-card">
          <span>当前实现</span>
          <strong>Next.js + Multi Source Connector + PostgreSQL Read Fallback</strong>
        </div>
      </section>

      <StatGrid
        items={[
          { label: "已接入知识源", value: cards.length },
          {
            label: "可用文档总数",
            value: availableCards.reduce((sum, item) => sum + (item.overview?.documentCount ?? 0), 0),
          },
          { label: "系统模块", value: 6 },
        ]}
      />

      <section className="panel">
        <div className="panel-header">
          <h2>知识源入口</h2>
          <p>后续会继续扩展到更多 GitHub 仓库、远程服务器目录和跨源统一检索。</p>
        </div>
        <div className="source-grid">
          {cards.map(({ source, overview, error }) => (
            <article className="source-card" key={source.id}>
              <div>
                <span className="source-type">{source.type}</span>
                <h3>{source.name}</h3>
                <p>{source.description ?? source.location}</p>
                <p>{source.location}</p>
              </div>
              <dl>
                <div>
                  <dt>文档</dt>
                  <dd>{overview?.documentCount ?? 0}</dd>
                </div>
                <div>
                  <dt>目录</dt>
                  <dd>{overview?.folderCount ?? 0}</dd>
                </div>
                <div>
                  <dt>标签</dt>
                  <dd>{overview?.tagCount ?? 0}</dd>
                </div>
              </dl>
              {error ? <p className="sync-error">读取失败：{error}</p> : null}
              <Link href={`/source/${source.id}`}>进入知识源</Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
