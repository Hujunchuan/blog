import Link from "next/link"
import { getSourceOverview, listSources } from "@/lib/knowledge-service"
import { StatGrid } from "@/components/stat-grid"

export default async function HomePage() {
  const sources = await listSources()
  const cards = await Promise.all(
    sources.map(async (source) => ({
      source,
      overview: await getSourceOverview(source.id),
    })),
  )

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Phase 1 Dynamic Platform</p>
          <h1>动态知识平台的第一版已经落地</h1>
          <p className="lead">
            当前版本先以本地目录为知识源，由 Next.js 服务端动态读取内容。概览、搜索和单篇文档已经支持优先从
            PostgreSQL 读取，Explorer 和图谱也已经接入数据库优先读取，并保留快照回退链路。
          </p>
        </div>
        <div className="hero-card">
          <span>当前实现</span>
          <strong>Next.js + Local Connector + PostgreSQL Read Fallback</strong>
        </div>
      </section>

      <StatGrid
        items={[
          { label: "已接入知识源", value: cards.length },
          {
            label: "文档总数",
            value: cards.reduce((sum, item) => sum + item.overview.documentCount, 0),
          },
          { label: "系统模块", value: 6 },
        ]}
      />

      <section className="panel">
        <div className="panel-header">
          <h2>知识源入口</h2>
          <p>后续会从这里扩展到 GitHub 仓库、远程服务器和统一数据库索引。</p>
        </div>
        <div className="source-grid">
          {cards.map(({ source, overview }) => (
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
                  <dd>{overview.documentCount}</dd>
                </div>
                <div>
                  <dt>目录</dt>
                  <dd>{overview.folderCount}</dd>
                </div>
                <div>
                  <dt>标签</dt>
                  <dd>{overview.tagCount}</dd>
                </div>
              </dl>
              <Link href={`/source/${source.id}`}>进入知识源</Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
