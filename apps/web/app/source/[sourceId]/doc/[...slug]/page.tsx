import { notFound } from "next/navigation"
import { DocumentContent } from "@/components/document-content"
import { getDocumentBySlug, getSource } from "@/lib/knowledge-service"

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ sourceId: string; slug: string[] }>
}) {
  const { sourceId, slug } = await params
  const fullSlug = slug.join("/")

  try {
    const source = await getSource(sourceId)
    const document = await getDocumentBySlug(sourceId, fullSlug)
    if (!document) notFound()

    return (
      <div className="page-stack">
        <section className="hero compact-hero">
          <div>
            <p className="eyebrow">{source.name}</p>
            <h1>{document.title}</h1>
            <p className="lead">{document.relativePath}</p>
          </div>
        </section>

        <article className="panel document-panel">
          <div className="document-meta">
            <span>更新时间：{new Date(document.updatedAt).toLocaleString("zh-CN")}</span>
            <span>标签：{document.tags.length}</span>
            <span>链接：{document.links.length}</span>
          </div>
          <DocumentContent content={document.content} />
        </article>
      </div>
    )
  } catch {
    notFound()
  }
}
