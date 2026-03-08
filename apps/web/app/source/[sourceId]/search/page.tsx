import Link from "next/link"
import { notFound } from "next/navigation"
import { documentUrl, getSource, searchDocuments } from "@/lib/knowledge-service"

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ sourceId: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { sourceId } = await params
  const { q = "" } = await searchParams

  try {
    const source = await getSource(sourceId)
    const results = await searchDocuments(sourceId, q)

    return (
      <div className="page-stack">
        <section className="hero compact-hero">
          <div>
            <p className="eyebrow">Search</p>
            <h1>{source.name}</h1>
            <p className="lead">当前查询：{q || "全部文档"}</p>
          </div>
          <form action={`/source/${sourceId}/search`} className="search-form">
            <input type="search" name="q" defaultValue={q} placeholder="搜索标题、摘要、标签" />
            <button type="submit">搜索</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>搜索结果</h2>
            <p>{results.length} 条</p>
          </div>
          <div className="result-list">
            {results.map((document) => (
              <article className="result-card" key={document.slug}>
                <h3>
                  <Link href={documentUrl(sourceId, document)} prefetch={false}>
                    {document.title}
                  </Link>
                </h3>
                <p>{document.summary}</p>
                <div className="tag-row">
                  {document.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    )
  } catch {
    notFound()
  }
}
