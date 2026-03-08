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
  graphUrl,
  knowledgeAnalysisUrl,
  searchDocuments,
  tagEntityKey,
} from "@/lib/knowledge-service"

export default async function SourcePage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params

  let source: Awaited<ReturnType<typeof getSource>>
  try {
    source = await getSource(sourceId)
  } catch {
    notFound()
  }

  const [overview, tree, graph, quickResults] = await Promise.all([
    getSourceOverview(sourceId),
    getExplorerTree(sourceId),
    getGraph(sourceId),
    searchDocuments(sourceId, ""),
  ])

  const defaultAnalysisHref =
    overview.recentDocuments[0] !== undefined
      ? knowledgeAnalysisUrl(sourceId, { slug: overview.recentDocuments[0].slug })
      : knowledgeAnalysisUrl(sourceId, {})

  return (
    <div className="page-stack">
      <section className="hero compact-hero">
        <div>
          <p className="eyebrow">{source.type}</p>
          <h1>{source.name}</h1>
          <p className="lead">{source.description ?? source.location}</p>
          <div className="action-row">
            <Link href={defaultAnalysisHref} className="ghost-link" prefetch={false}>
              {"\u6253\u5F00\u77E5\u8BC6\u5206\u6790"}
            </Link>
            <Link href={graphUrl(sourceId, { mode: "documents" })} className="ghost-link" prefetch={false}>
              {"\u6253\u5F00\u56FE\u8C31"}
            </Link>
          </div>
        </div>
        <form action={`/source/${encodeURIComponent(sourceId)}/search`} className="search-form">
          <input
            type="search"
            name="q"
            placeholder={"\u641C\u7D22\u6807\u9898\u3001\u6458\u8981\u3001\u6807\u7B7E"}
          />
          <button type="submit">{"\u641C\u7D22"}</button>
        </form>
      </section>

      <StatGrid
        items={[
          { label: "\u6587\u6863\u6570", value: overview.documentCount },
          { label: "\u76EE\u5F55\u6570", value: overview.folderCount },
          { label: "\u6807\u7B7E\u6570", value: overview.tagCount },
          { label: "\u94FE\u63A5\u6570", value: overview.linkCount },
        ]}
      />

      <div className="two-column">
        <ExplorerTree sourceId={sourceId} nodes={tree} />

        <div className="page-stack">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>{"\u77E5\u8BC6\u5206\u6790\u5165\u53E3"}</h2>
                <p>
                  {
                    "\u4ECE\u6700\u8FD1\u6587\u6863\u6216\u9AD8\u9891\u6807\u7B7E\u8FDB\u5165 nervous system \u89C6\u56FE\u3002"
                  }
                </p>
              </div>
            </div>
            <div className="tag-row">
              {overview.recentDocuments.slice(0, 6).map((document) => (
                <Link
                  key={`doc-${document.slug}`}
                  href={knowledgeAnalysisUrl(sourceId, { slug: document.slug })}
                  className="tag-chip"
                  prefetch={false}
                >
                  {`\u6587\u6863: ${document.title}`}
                </Link>
              ))}
              {overview.topTags.slice(0, 6).map((tag) => (
                <Link
                  key={`tag-${tag.tag}`}
                  href={knowledgeAnalysisUrl(sourceId, { entityKey: tagEntityKey(tag.tag) })}
                  className="tag-chip"
                  prefetch={false}
                >
                  {`\u6807\u7B7E: ${tag.tag}`}
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>{"\u6700\u8FD1\u66F4\u65B0"}</h2>
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
                  <div className="action-row">
                    <Link href={documentUrl(sourceId, document)} className="ghost-link" prefetch={false}>
                      {"\u67E5\u770B\u6587\u6863"}
                    </Link>
                    <Link
                      href={knowledgeAnalysisUrl(sourceId, { slug: document.slug })}
                      className="ghost-link"
                      prefetch={false}
                    >
                      {"\u77E5\u8BC6\u5206\u6790"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>{"\u56FE\u8C31\u6982\u89C8"}</h2>
                <p>
                  {
                    "\u5F53\u524D\u4F18\u5148\u4ECE PostgreSQL \u8BFB\u53D6\u56FE\u8C31\u7EDF\u8BA1\uFF0C\u6570\u636E\u5E93\u4E0D\u53EF\u7528\u65F6\u81EA\u52A8\u56DE\u9000\u5230\u5185\u5B58\u5FEB\u7167\u3002"
                  }
                </p>
              </div>
            </div>
            <StatGrid
              items={[
                { label: "\u56FE\u8C31\u8282\u70B9", value: graph.nodes.length },
                { label: "\u56FE\u8C31\u8FB9", value: graph.edges.length },
                { label: "\u5FEB\u901F\u641C\u7D22\u7ED3\u679C", value: quickResults.length },
              ]}
            />
            <div className="action-row">
              <Link href={graphUrl(sourceId, { mode: "documents" })} className="ghost-link" prefetch={false}>
                {"\u67E5\u770B\u6587\u6863\u56FE\u8C31"}
              </Link>
              <Link href={graphUrl(sourceId, { mode: "knowledge" })} className="ghost-link" prefetch={false}>
                {"\u67E5\u770B\u77E5\u8BC6\u56FE\u8C31"}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
