import Link from "next/link"
import { notFound } from "next/navigation"
import { DocumentContent } from "@/components/document-content"
import { getDocumentBySlug, getSource, knowledgeAnalysisUrl, tagEntityKey } from "@/lib/knowledge-service"

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

  return (
    <div className="page-stack">
      <section className="hero compact-hero">
        <div>
          <p className="eyebrow">{source.name}</p>
          <h1>{document.title}</h1>
          <p className="lead">{document.relativePath}</p>
          <div className="action-row">
            <Link href={`/source/${encodeURIComponent(sourceId)}`} className="ghost-link" prefetch={false}>
              {"\u8FD4\u56DE\u77E5\u8BC6\u6E90"}
            </Link>
            <Link
              href={knowledgeAnalysisUrl(sourceId, { slug: document.slug })}
              className="ghost-link"
              prefetch={false}
            >
              {"\u77E5\u8BC6\u5206\u6790"}
            </Link>
          </div>
        </div>
      </section>

      <article className="panel document-panel">
        <div className="document-meta">
          <span>{`\u66F4\u65B0\u65F6\u95F4: ${new Date(document.updatedAt).toLocaleString("zh-CN")}`}</span>
          <span>{`\u6807\u7B7E: ${document.tags.length}`}</span>
          <span>{`\u94FE\u63A5: ${document.links.length}`}</span>
        </div>

        {document.tags.length > 0 && (
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
        )}

        <DocumentContent content={document.content} />
      </article>
    </div>
  )
}
