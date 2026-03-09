import Link from "next/link"
import {
  documentUrl,
  graphUrl,
  knowledgeAnalysisUrl,
  listSources,
  searchAcrossSources,
} from "@/lib/knowledge-service"

export const dynamic = "force-dynamic"

type SearchPageSearchParams = {
  q?: string
  source?: string
}

export default async function CrossSourceSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchPageSearchParams>
}) {
  const { q = "", source: sourceFilter = "" } = await searchParams
  const sources = await listSources()
  const selectedSource = sources.find((item) => item.id === sourceFilter)
  const result = await searchAcrossSources(q, {
    sourceIds: selectedSource ? [selectedSource.id] : undefined,
    limit: 60,
    limitPerSource: 20,
  })

  return (
    <div className="page-stack">
      <section className="hero compact-hero">
        <div>
          <p className="eyebrow">跨源搜索</p>
          <h1>统一知识检索</h1>
          <p className="lead">
            {selectedSource
              ? `当前在 ${selectedSource.name} 内搜索：${q || "全部文档"}`
              : `当前在全部知识源内搜索：${q || "全部文档"}`}
          </p>
          <div className="action-row">
            <Link href="/" className="ghost-link" prefetch={false}>
              返回首页
            </Link>
            <Link href="/admin" className="ghost-link" prefetch={false}>
              管理台
            </Link>
          </div>
        </div>
        <form action="/search" className="search-form search-form-extended">
          <select name="source" defaultValue={selectedSource?.id ?? ""}>
            <option value="">全部知识源</option>
            {sources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input type="search" name="q" defaultValue={q} placeholder="搜索标题、摘要、标签或正文" />
          <button type="submit">搜索</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>知识源筛选</h2>
            <p>跨源搜索默认覆盖所有已启用知识源，也可以切到单一知识源查看结果。</p>
          </div>
          <div className="tag-row">
            <Link href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"} className="tag-chip" prefetch={false}>
              全部知识源
            </Link>
            {sources.map((item) => {
              const href = q
                ? `/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(item.id)}`
                : `/search?source=${encodeURIComponent(item.id)}`
              return (
                <Link
                  key={item.id}
                  href={href}
                  className="tag-chip"
                  data-active={selectedSource?.id === item.id ? "true" : "false"}
                  prefetch={false}
                >
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>搜索结果</h2>
            <p>{`已返回 ${result.items.length} 条结果，覆盖 ${result.sources.length} 个知识源。`}</p>
          </div>
        </div>
        <div className="result-list">
          {result.items.map((item) => (
            <article className="result-card" key={`${item.source.id}:${item.document.slug}`}>
              <div className="badge-row">
                <span className="badge">{item.source.name}</span>
                <span className="badge">{item.source.type}</span>
                <span className="badge">{`分值 ${item.score}`}</span>
              </div>
              <h3>
                <Link href={documentUrl(item.source.id, item.document)} prefetch={false}>
                  {item.document.title}
                </Link>
              </h3>
              <p>{item.document.summary}</p>
              <small>{new Date(item.document.updatedAt).toLocaleString("zh-CN")}</small>
              <div className="tag-row">
                {item.document.tags.slice(0, 8).map((tag) => (
                  <span key={`${item.source.id}:${item.document.slug}:${tag}`} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="action-row">
                <Link href={`/source/${encodeURIComponent(item.source.id)}`} className="ghost-link" prefetch={false}>
                  打开知识源
                </Link>
                <Link href={documentUrl(item.source.id, item.document)} className="ghost-link" prefetch={false}>
                  查看文档
                </Link>
                <Link
                  href={knowledgeAnalysisUrl(item.source.id, { slug: item.document.slug })}
                  className="ghost-link"
                  prefetch={false}
                >
                  知识分析
                </Link>
                <Link
                  href={graphUrl(item.source.id, { mode: "documents", focus: item.document.slug })}
                  className="ghost-link"
                  prefetch={false}
                >
                  文档图谱
                </Link>
              </div>
            </article>
          ))}
          {result.items.length === 0 && (
            <div className="empty-state">当前条件下没有命中文档。可以尝试清空搜索词或切换知识源范围。</div>
          )}
        </div>
      </section>

      {result.failures.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>读取异常</h2>
              <p>这些知识源在本次搜索中没有成功返回结果。</p>
            </div>
          </div>
          <div className="result-list">
            {result.failures.map((item) => (
              <article className="result-card" key={`error:${item.source.id}`}>
                <h3>{item.source.name}</h3>
                <p>{item.error}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
