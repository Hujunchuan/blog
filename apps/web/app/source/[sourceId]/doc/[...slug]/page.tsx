import Link from "next/link"
import { notFound } from "next/navigation"
import { DocumentContent } from "@/components/document-content"
import { getDocumentBySlug, getSource, graphUrl, knowledgeAnalysisUrl, tagEntityKey } from "@/lib/knowledge-service"
import { buildHeadingAnchors } from "@/lib/render-markdown"

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ sourceId: string; slug: string[] }>
}) {
  const { sourceId, slug } = await params
  const fullSlug = slug.map((segment) => safeDecodeSegment(segment)).join("/")

  let source: Awaited<ReturnType<typeof getSource>>
  try {
    source = await getSource(sourceId)
  } catch {
    notFound()
  }

  const document = await getDocumentBySlug(sourceId, fullSlug)
  if (!document) {
    notFound()
  }
  const outline = buildHeadingAnchors(document.headings)

  return (
    <div className="page-stack">
      <div className="quartz-page-grid document-layout">
        <aside className="quartz-side-column">
          <section className="panel side-panel document-side-panel">
            <div className="panel-header">
              <div>
                <h2>{"\u6587\u6863\u5BFC\u822A"}</h2>
                <p>{source.name}</p>
              </div>
            </div>
            <div className="document-meta-stack">
              <div className="document-meta-card">
                <span>{"\u8DEF\u5F84"}</span>
                <strong>{document.relativePath}</strong>
              </div>
              <div className="document-meta-card">
                <span>{"\u66F4\u65B0\u65F6\u95F4"}</span>
                <strong>{new Date(document.updatedAt).toLocaleString("zh-CN")}</strong>
              </div>
              <div className="document-meta-grid">
                <div className="document-meta-card">
                  <span>{"\u6807\u7B7E"}</span>
                  <strong>{document.tags.length}</strong>
                </div>
                <div className="document-meta-card">
                  <span>{"\u94FE\u63A5"}</span>
                  <strong>{document.links.length}</strong>
                </div>
              </div>
            </div>
            <div className="action-row">
              <Link href={`/source/${encodeURIComponent(sourceId)}`} className="ghost-link" prefetch={false}>
                {"\u8FD4\u56DE\u77E5\u8BC6\u6E90"}
              </Link>
              <Link href={knowledgeAnalysisUrl(sourceId, { slug: document.slug })} className="ghost-link" prefetch={false}>
                {"\u77E5\u8BC6\u5206\u6790"}
              </Link>
              <Link
                href={graphUrl(sourceId, { mode: "documents", focus: document.slug })}
                className="ghost-link"
                prefetch={false}
              >
                {"\u6587\u6863\u56FE\u8C31"}
              </Link>
            </div>
            {document.tags.length > 0 && (
              <div>
                <h3>{"\u6807\u7B7E"}</h3>
                <div className="tag-row">
                  {document.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={knowledgeAnalysisUrl(sourceId, { entityKey: tagEntityKey(tag) })}
                      className="tag-chip"
                      prefetch={false}
                    >
                      {`#${tag}`}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          {outline.length > 0 && (
            <section className="panel side-panel document-side-panel">
              <div className="panel-header">
                <div>
                  <h2>{"\u5927\u7EB2"}</h2>
                  <p>{"\u76F4\u63A5\u8DF3\u5230\u5F53\u524D\u6587\u6863\u7684\u5C0F\u8282\u3002"}</p>
                </div>
              </div>
              <nav className="document-outline-list">
                {outline.slice(0, 18).map((item) => (
                  <a key={item.id} href={`#${item.id}`} className="document-outline-link">
                    {item.text}
                  </a>
                ))}
              </nav>
            </section>
          )}
        </aside>

        <div className="quartz-main-column page-stack">
          <header className="panel quartz-page-header document-header">
            <p className="eyebrow">{source.name}</p>
            <h1>{document.title}</h1>
            <p className="lead">{document.relativePath}</p>
          </header>

          <article className="panel document-panel">
            <DocumentContent sourceId={sourceId} slug={document.slug} content={document.content} />
          </article>
        </div>
      </div>
    </div>
  )
}
