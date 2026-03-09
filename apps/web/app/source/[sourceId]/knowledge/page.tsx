import Link from "next/link"
import { notFound } from "next/navigation"
import { StatGrid } from "@/components/stat-grid"
import {
  documentUrl,
  getKnowledgeEvidence,
  getKnowledgeImpact,
  getRelatedKnowledge,
  getSource,
  getSourceOverview,
  graphUrl,
  knowledgeAnalysisUrl,
  tagEntityKey,
} from "@/lib/knowledge-service"

export const dynamic = "force-dynamic"

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildCountSummary(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "zh-CN"))
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

function mergeAnalysisInput(
  base: {
    slug?: string
    entityKey?: string
    depth?: number
    limit?: number
    relationType?: string
    direction?: string
    entityType?: string
  },
  overrides: Partial<{
    slug?: string
    entityKey?: string
    depth?: number
    limit?: number
    relationType?: string
    direction?: string
    entityType?: string
  }>,
) {
  return {
    slug: "slug" in overrides ? overrides.slug : base.slug,
    entityKey: "entityKey" in overrides ? overrides.entityKey : base.entityKey,
    depth: "depth" in overrides ? overrides.depth : base.depth,
    limit: "limit" in overrides ? overrides.limit : base.limit,
    relationType: "relationType" in overrides ? overrides.relationType : base.relationType,
    direction: "direction" in overrides ? overrides.direction : base.direction,
    entityType: "entityType" in overrides ? overrides.entityType : base.entityType,
  }
}

const entityTypeLabels: Record<string, string> = {
  document: "\u6587\u6863",
  tag: "\u6807\u7B7E",
  concept: "\u6982\u5FF5",
  person: "\u4EBA\u7269",
  project: "\u9879\u76EE",
  meeting: "\u4F1A\u8BAE",
  decision: "\u51B3\u7B56",
  task: "\u4EFB\u52A1",
  practice: "\u5B9E\u8DF5",
}

const relationTypeLabels: Record<string, string> = {
  belongs_to: "\u5F52\u5C5E",
  references: "\u5F15\u7528",
  mentions: "\u63D0\u53CA",
  explains: "\u89E3\u91CA",
  derived_from: "\u6D3E\u751F\u81EA",
  decides: "\u51B3\u5B9A",
  supports: "\u652F\u6301",
  contradicts: "\u51B2\u7A81",
  related_to: "\u76F8\u5173",
  next_step_for: "\u540E\u7EED\u6B65\u9AA4",
}

const directionLabels: Record<string, string> = {
  incoming: "\u6D41\u5165",
  outgoing: "\u6D41\u51FA",
}

function uniqueByEntityKey<T extends { entityKey: string }>(items: T[]) {
  const seen = new Map<string, T>()
  for (const item of items) {
    if (!seen.has(item.entityKey)) {
      seen.set(item.entityKey, item)
    }
  }
  return [...seen.values()]
}

function buildEntityLabelMap(items: Array<{ entityKey: string; canonicalName: string }>) {
  return new Map(items.map((item) => [item.entityKey, item.canonicalName]))
}

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ sourceId: string }>
  searchParams: Promise<{
    slug?: string | string[]
    entityKey?: string | string[]
    depth?: string | string[]
    limit?: string | string[]
    relationType?: string | string[]
    direction?: string | string[]
    entityType?: string | string[]
  }>
}) {
  const { sourceId } = await params
  const resolvedSearchParams = await searchParams
  const slug = firstValue(resolvedSearchParams.slug)
  const entityKey = firstValue(resolvedSearchParams.entityKey)
  const depth = parseNumber(firstValue(resolvedSearchParams.depth), 2)
  const limit = parseNumber(firstValue(resolvedSearchParams.limit), 12)
  const relationType = firstValue(resolvedSearchParams.relationType)
  const direction = firstValue(resolvedSearchParams.direction)
  const entityType = firstValue(resolvedSearchParams.entityType)

  let source: Awaited<ReturnType<typeof getSource>>
  try {
    source = await getSource(sourceId)
  } catch {
    notFound()
  }

  const overview = await getSourceOverview(sourceId)
  const hasSelection = Boolean(slug || entityKey)

  const [related, impact, evidence] = hasSelection
    ? await Promise.all([
        getRelatedKnowledge(sourceId, { slug, entityKey, limit }),
        getKnowledgeImpact(sourceId, { slug, entityKey, depth, limit: Math.max(limit, 24) }),
        getKnowledgeEvidence(sourceId, { slug, entityKey, limit }),
      ])
    : [null, null, null]

  const root = related?.root ?? impact?.root ?? evidence?.root ?? null
  const mergedEntities = uniqueByEntityKey([...(related?.entities ?? []), ...(impact?.entities ?? []), ...(root ? [root] : [])])
  const entityLabelMap = buildEntityLabelMap(mergedEntities)
  const analysisInput = {
    slug,
    entityKey,
    depth,
    limit,
    relationType,
    direction,
    entityType,
  }
  const filteredRelatedRelations = (related?.relations ?? []).filter((relation) => {
    if (relationType && relation.relationType !== relationType) {
      return false
    }
    if (direction && relation.direction !== direction) {
      return false
    }
    return true
  })
  const filteredImpactEntities = (impact?.entities ?? []).filter((entity) => {
    if (entity.entityKey === root?.entityKey) {
      return false
    }
    if (entityType && entity.entityType !== entityType) {
      return false
    }
    return true
  })
  const evidenceRelationMap = new Map(
    uniqueStrings([...(related?.relations ?? []), ...(evidence?.relations ?? [])].map((relation) => relation.relationKey)).map(
      (relationKey) => {
        const relation =
          [...(related?.relations ?? []), ...(evidence?.relations ?? [])].find((item) => item.relationKey === relationKey)!
        return [relationKey, relation] as const
      },
    ),
  )
  const filteredEvidenceDocuments = (evidence?.documents ?? []).filter((document) =>
    document.relationKeys.some((relationKey) => {
      const relation = evidenceRelationMap.get(relationKey)
      if (!relation) {
        return !relationType && !direction
      }
      if (relationType && relation.relationType !== relationType) {
        return false
      }
      if (direction && relation.direction !== direction) {
        return false
      }
      return true
    }),
  )
  const relationTypeSummary = buildCountSummary((related?.relations ?? []).map((relation) => relation.relationType))
  const directionSummary = buildCountSummary((related?.relations ?? []).map((relation) => relation.direction))
  const impactTypeSummary = buildCountSummary(
    (impact?.entities ?? []).filter((entity) => entity.entityKey !== root?.entityKey).map((entity) => entity.entityType),
  )

  return (
    <div className="page-stack">
      <section className="hero compact-hero">
        <div>
          <p className="eyebrow">nervous system</p>
          <h1>{"\u77E5\u8BC6\u5206\u6790"}</h1>
          <p className="lead">
            {
              "\u57FA\u4E8E\u5F53\u524D\u77E5\u8BC6\u6E90\u7684 entities / relations\uFF0C\u67E5\u770B\u76F8\u5173\u5173\u7CFB\u3001\u5F71\u54CD\u5206\u6790\u548C\u8BC1\u636E\u6587\u6863\u3002"
            }
          </p>
          <div className="action-row">
            <Link href={`/source/${encodeURIComponent(sourceId)}`} className="ghost-link" prefetch={false}>
              {`\u8FD4\u56DE ${source.name}`}
            </Link>
            <Link
              href={graphUrl(sourceId, {
                mode: "knowledge",
                focus: entityKey ?? (slug ? `document:${slug}` : undefined),
              })}
              className="ghost-link"
              prefetch={false}
            >
              {"\u6253\u5F00\u77E5\u8BC6\u56FE\u8C31"}
            </Link>
          </div>
        </div>
        <form action={`/source/${encodeURIComponent(sourceId)}/knowledge`} className="analysis-form">
          <label>
            {"\u6587\u6863 slug"}
            <input
              type="text"
              name="slug"
              defaultValue={slug ?? ""}
              placeholder={"\u4F8B\u5982\uFF1A\u4EA7\u54C1\u521D\u8877\u3001\u56E2\u961F\u72B6\u6001\u4E0E\u53D1\u5C55\u65B9\u5411"}
            />
          </label>
          <label>
            {"\u5B9E\u4F53 key"}
            <input type="text" name="entityKey" defaultValue={entityKey ?? ""} placeholder={"\u4F8B\u5982\uFF1Atag:AI"} />
          </label>
          <label>
            {"\u6DF1\u5EA6"}
            <input type="number" name="depth" min={1} max={6} defaultValue={depth} />
          </label>
          <label>
            {"\u9650\u5236"}
            <input type="number" name="limit" min={1} max={100} defaultValue={limit} />
          </label>
          <button type="submit">{"\u5206\u6790"}</button>
        </form>
      </section>

      {!hasSelection && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>{"\u5FEB\u901F\u8FDB\u5165"}</h2>
              <p>
                {
                  "\u4ECE\u6700\u8FD1\u6587\u6863\u6216\u9AD8\u9891\u6807\u7B7E\u5F00\u59CB\u67E5\u770B nervous system\u3002"
                }
              </p>
            </div>
          </div>
          <div className="tag-row">
            {overview.recentDocuments.slice(0, 8).map((document) => (
              <Link
                key={`recent-${document.slug}`}
                href={knowledgeAnalysisUrl(sourceId, { slug: document.slug })}
                className="tag-chip"
                prefetch={false}
              >
                {`\u6587\u6863: ${document.title}`}
              </Link>
            ))}
            {overview.topTags.slice(0, 8).map((tag) => (
              <Link
                key={`top-tag-${tag.tag}`}
                href={knowledgeAnalysisUrl(sourceId, { entityKey: tagEntityKey(tag.tag) })}
                className="tag-chip"
                prefetch={false}
              >
                {`\u6807\u7B7E: ${tag.tag}`}
              </Link>
            ))}
          </div>
        </section>
      )}

      {hasSelection && !root && (
        <section className="panel">
          <div className="empty-state">
            {"\u6CA1\u6709\u627E\u5230\u5BF9\u5E94\u8282\u70B9\uFF0C\u8BF7\u68C0\u67E5 slug \u6216 entityKey \u662F\u5426\u6B63\u786E\u3002"}
          </div>
        </section>
      )}

      {root && (
        <>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>{root.canonicalName}</h2>
                <p>
                  {`${"\u5F53\u524D\u8282\u70B9\u7C7B\u578B"}: ${entityTypeLabels[root.entityType] ?? root.entityType}`}
                  {root.slug ? ` | slug: ${root.slug}` : ""}
                </p>
              </div>
            </div>
            <div className="action-row">
              {root.slug && (
                <Link href={documentUrl(sourceId, { slug: root.slug })} className="ghost-link" prefetch={false}>
                  {"\u6253\u5F00\u539F\u6587\u6863"}
                </Link>
              )}
              <Link
                href={knowledgeAnalysisUrl(sourceId, { entityKey: root.entityKey, depth, limit })}
                className="ghost-link"
                prefetch={false}
              >
                {"\u56FA\u5B9A\u5230 entityKey"}
              </Link>
              <Link
                href={graphUrl(sourceId, { mode: "knowledge", focus: root.entityKey })}
                className="ghost-link"
                prefetch={false}
              >
                {"\u5728\u56FE\u8C31\u4E2D\u67E5\u770B"}
              </Link>
            </div>
            {(relationType || direction || entityType) && (
              <div className="badge-row">
                {relationType && (
                  <span className="badge">{`${"\u5173\u7CFB"}: ${relationTypeLabels[relationType] ?? relationType}`}</span>
                )}
                {direction && (
                  <span className="badge">{`${"\u65B9\u5411"}: ${directionLabels[direction] ?? direction}`}</span>
                )}
                {entityType && (
                  <span className="badge">{`${"\u5B9E\u4F53"}: ${entityTypeLabels[entityType] ?? entityType}`}</span>
                )}
                <Link
                  href={knowledgeAnalysisUrl(
                    sourceId,
                    mergeAnalysisInput(analysisInput, {
                      relationType: undefined,
                      direction: undefined,
                      entityType: undefined,
                    }),
                  )}
                  className="ghost-link"
                  prefetch={false}
                >
                  {"\u6E05\u9664\u7B5B\u9009"}
                </Link>
              </div>
            )}
          </section>

          <StatGrid
            items={[
              { label: "\u76F8\u5173\u5173\u7CFB", value: filteredRelatedRelations.length },
              { label: "\u5F71\u54CD\u8282\u70B9", value: filteredImpactEntities.length },
              { label: "\u8BC1\u636E\u6587\u6863", value: filteredEvidenceDocuments.length },
              { label: "\u5F71\u54CD\u6DF1\u5EA6", value: impact?.summary.maxDepth ?? depth },
            ]}
          />

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>{"\u5206\u6790\u89C6\u89D2"}</h2>
                <p>{"\u5728\u4E0D\u79BB\u5F00\u5F53\u524D\u8282\u70B9\u7684\u60C5\u51B5\u4E0B\uFF0C\u6309\u5173\u7CFB\u7C7B\u578B\u3001\u65B9\u5411\u548C\u5F71\u54CD\u5B9E\u4F53\u7C7B\u578B\u5207\u7247\u3002"}</p>
              </div>
            </div>
            <div className="page-stack">
              <div>
                <h3>{"\u5173\u7CFB\u7C7B\u578B"}</h3>
                <div className="tag-row">
                  <Link
                    href={knowledgeAnalysisUrl(sourceId, mergeAnalysisInput(analysisInput, { relationType: undefined }))}
                    className="tag-chip"
                    data-active={!relationType}
                    prefetch={false}
                  >
                    {"\u5168\u90E8\u5173\u7CFB"}
                  </Link>
                  {relationTypeSummary.map((item) => (
                    <Link
                      key={item.key}
                      href={knowledgeAnalysisUrl(sourceId, mergeAnalysisInput(analysisInput, { relationType: item.key }))}
                      className="tag-chip"
                      data-active={relationType === item.key}
                      prefetch={false}
                    >
                      {`${relationTypeLabels[item.key] ?? item.key} · ${item.count}`}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3>{"\u5173\u7CFB\u65B9\u5411"}</h3>
                <div className="tag-row">
                  <Link
                    href={knowledgeAnalysisUrl(sourceId, mergeAnalysisInput(analysisInput, { direction: undefined }))}
                    className="tag-chip"
                    data-active={!direction}
                    prefetch={false}
                  >
                    {"\u5168\u90E8\u65B9\u5411"}
                  </Link>
                  {directionSummary.map((item) => (
                    <Link
                      key={item.key}
                      href={knowledgeAnalysisUrl(sourceId, mergeAnalysisInput(analysisInput, { direction: item.key }))}
                      className="tag-chip"
                      data-active={direction === item.key}
                      prefetch={false}
                    >
                      {`${directionLabels[item.key] ?? item.key} · ${item.count}`}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3>{"\u5F71\u54CD\u5B9E\u4F53\u7C7B\u578B"}</h3>
                <div className="tag-row">
                  <Link
                    href={knowledgeAnalysisUrl(sourceId, mergeAnalysisInput(analysisInput, { entityType: undefined }))}
                    className="tag-chip"
                    data-active={!entityType}
                    prefetch={false}
                  >
                    {"\u5168\u90E8\u7C7B\u578B"}
                  </Link>
                  {impactTypeSummary.map((item) => (
                    <Link
                      key={item.key}
                      href={knowledgeAnalysisUrl(sourceId, mergeAnalysisInput(analysisInput, { entityType: item.key }))}
                      className="tag-chip"
                      data-active={entityType === item.key}
                      prefetch={false}
                    >
                      {`${entityTypeLabels[item.key] ?? item.key} · ${item.count}`}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="action-row">
                <Link
                  href={knowledgeAnalysisUrl(
                    sourceId,
                    mergeAnalysisInput(analysisInput, {
                      relationType: undefined,
                      direction: undefined,
                      entityType: undefined,
                    }),
                  )}
                  className="ghost-link"
                  prefetch={false}
                >
                  {"\u6E05\u9664\u7B5B\u9009"}
                </Link>
              </div>
            </div>
          </section>

          <div className="analysis-grid">
            <section id="related" className="panel analysis-section">
              <div className="panel-header">
                <div>
                  <h2>{"\u76F8\u5173\u5173\u7CFB"}</h2>
                  <p>{"\u5F53\u524D\u8282\u70B9\u7684\u4E00\u8DF3\u76F8\u90BB\u5173\u7CFB\u3002"}</p>
                </div>
              </div>
              <div className="result-list">
                {filteredRelatedRelations.map((relation) => {
                  const peerKey =
                    relation.fromEntityKey === root.entityKey ? relation.toEntityKey : relation.fromEntityKey
                  const peerLabel = entityLabelMap.get(peerKey) ?? peerKey

                  return (
                    <article key={relation.relationKey} className="result-card">
                      <h3>{peerLabel}</h3>
                      <p>
                        {`${directionLabels[relation.direction]} | ${
                          relationTypeLabels[relation.relationType] ?? relation.relationType
                        }`}
                      </p>
                      {relation.evidenceDocumentSlug && (
                        <div className="action-row">
                          <Link
                            href={knowledgeAnalysisUrl(
                              sourceId,
                              mergeAnalysisInput(analysisInput, {
                                relationType: relation.relationType,
                                direction: relation.direction,
                              }),
                            )}
                            className="ghost-link"
                            prefetch={false}
                          >
                            {"\u53EA\u770B\u6B64\u7C7B\u5173\u7CFB"}
                          </Link>
                          <Link
                            href={knowledgeAnalysisUrl(sourceId, { slug: relation.evidenceDocumentSlug, depth, limit })}
                            className="ghost-link"
                            prefetch={false}
                          >
                            {"\u5206\u6790\u8BE5\u8BC1\u636E"}
                          </Link>
                          <Link
                            href={documentUrl(sourceId, { slug: relation.evidenceDocumentSlug })}
                            className="ghost-link"
                            prefetch={false}
                          >
                            {"\u67E5\u770B\u8BC1\u636E\u6587\u6863"}
                          </Link>
                        </div>
                      )}
                    </article>
                  )
                })}
                {filteredRelatedRelations.length === 0 && (
                  <div className="empty-state">{"\u5F53\u524D\u8282\u70B9\u8FD8\u6CA1\u6709\u4E00\u8DF3\u5173\u7CFB\u3002"}</div>
                )}
              </div>
            </section>

            <section id="impact" className="panel analysis-section">
              <div className="panel-header">
                <div>
                  <h2>{"\u5F71\u54CD\u5206\u6790"}</h2>
                  <p>{"\u4ECE\u5F53\u524D\u8282\u70B9\u51FA\u53D1\u7684\u591A\u8DF3\u5F71\u54CD\u8303\u56F4\u3002"}</p>
                </div>
              </div>
              <div className="result-list">
                {filteredImpactEntities.map((entity) => (
                    <article key={entity.entityKey} className="result-card">
                      <h3>{entity.canonicalName}</h3>
                      <p>{`${"\u6DF1\u5EA6"} ${entity.depth} | ${entityTypeLabels[entity.entityType] ?? entity.entityType}`}</p>
                      <div className="badge-row">
                        <span className="badge">{`${"\u7C7B\u578B"} ${entityTypeLabels[entity.entityType] ?? entity.entityType}`}</span>
                        <span className="badge">{`${"\u6DF1\u5EA6"} ${entity.depth}`}</span>
                      </div>
                      <div className="action-row">
                        <Link
                          href={knowledgeAnalysisUrl(sourceId, {
                            entityKey: entity.entityKey,
                            depth,
                            limit,
                          })}
                          className="ghost-link"
                          prefetch={false}
                        >
                          {"\u5207\u6362\u5206\u6790"}
                        </Link>
                        {entity.slug && (
                          <Link href={documentUrl(sourceId, { slug: entity.slug })} className="ghost-link" prefetch={false}>
                            {"\u6253\u5F00\u6587\u6863"}
                          </Link>
                        )}
                        <Link
                          href={knowledgeAnalysisUrl(
                            sourceId,
                            mergeAnalysisInput(analysisInput, { entityType: entity.entityType }),
                          )}
                          className="ghost-link"
                          prefetch={false}
                        >
                          {"\u53EA\u770B\u8FD9\u7C7B\u8282\u70B9"}
                        </Link>
                      </div>
                    </article>
                  ))}
                {filteredImpactEntities.length === 0 && (
                  <div className="empty-state">{"\u5F53\u524D\u8282\u70B9\u7684\u5F71\u54CD\u8303\u56F4\u8FD8\u6BD4\u8F83\u5C0F\u3002"}</div>
                )}
              </div>
            </section>
          </div>

          <section id="evidence" className="panel analysis-section">
            <div className="panel-header">
              <div>
                <h2>{"\u8BC1\u636E\u6587\u6863"}</h2>
                <p>{"\u5F53\u524D\u8282\u70B9\u76F8\u5173\u5173\u7CFB\u6240\u6307\u5411\u7684\u8BC1\u636E\u6587\u6863\u3002"}</p>
              </div>
            </div>
            <div className="result-list">
              {filteredEvidenceDocuments.map((document) => {
                const documentRelations = document.relationKeys
                  .map((relationKey) => evidenceRelationMap.get(relationKey))
                  .filter((relation): relation is NonNullable<typeof relation> => Boolean(relation))
                const documentRelationTypes = uniqueStrings(documentRelations.map((relation) => relation.relationType))

                return (
                  <article key={document.slug} className="result-card">
                    <h3>
                      <Link href={documentUrl(sourceId, document)} prefetch={false}>
                        {document.title}
                      </Link>
                    </h3>
                    <p>{document.summary}</p>
                    <small>{new Date(document.updatedAt).toLocaleString("zh-CN")}</small>
                    <div className="badge-row">
                      <span className="badge">{`\u5173\u8054\u5173\u7CFB ${document.relationKeys.length}`}</span>
                      {documentRelationTypes.map((item) => (
                        <span key={`${document.slug}-${item}`} className="badge">
                          {relationTypeLabels[item] ?? item}
                        </span>
                      ))}
                    </div>
                    <div className="action-row">
                      <Link href={documentUrl(sourceId, document)} className="ghost-link" prefetch={false}>
                        {"\u67E5\u770B\u6587\u6863"}
                      </Link>
                      <Link
                        href={knowledgeAnalysisUrl(sourceId, { slug: document.slug, depth, limit })}
                        className="ghost-link"
                        prefetch={false}
                      >
                        {"\u5206\u6790\u6B64\u8BC1\u636E"}
                      </Link>
                      {documentRelationTypes[0] && (
                        <Link
                          href={knowledgeAnalysisUrl(
                            sourceId,
                            mergeAnalysisInput(analysisInput, { relationType: documentRelationTypes[0] }),
                          )}
                          className="ghost-link"
                          prefetch={false}
                        >
                          {"\u53EA\u770B\u8BE5\u8BC1\u636E\u5173\u7CFB"}
                        </Link>
                      )}
                    </div>
                  </article>
                )
              })}
              {filteredEvidenceDocuments.length === 0 && (
                <div className="empty-state">{"\u5F53\u524D\u8282\u70B9\u8FD8\u6CA1\u6709\u8BC1\u636E\u6587\u6863\u3002"}</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
