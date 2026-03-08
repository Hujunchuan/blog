import { renderKnowledgeMarkdown } from "@/lib/render-markdown"

export async function DocumentContent({
  sourceId,
  slug,
  content,
}: {
  sourceId: string
  slug: string
  content: string
}) {
  const html = await renderKnowledgeMarkdown({
    sourceId,
    slug,
    content,
  })

  return (
    <div className="document-surface">
      <div className="document-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
