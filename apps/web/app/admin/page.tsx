import { checkDatabaseHealth, getPersistedOverview, isDatabaseConfigured } from "@repo/db/index"
import { AdminConsole } from "@/components/admin-console"
import { listSources } from "@/lib/knowledge-service"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const sources = await listSources()
  const configured = isDatabaseConfigured()

  let dbStatus = "not_configured"
  if (configured) {
    try {
      const result = await checkDatabaseHealth()
      dbStatus = result.status
    } catch {
      dbStatus = "error"
    }
  }

  const sourceStatuses = await Promise.all(
    sources.map(async (source) => {
      if (!configured) {
        return {
          ...source,
          persisted: false,
          latestSyncRun: null,
        }
      }

      try {
        const overview = await getPersistedOverview(source.id)
        return {
          ...source,
          persisted: Boolean(overview),
          latestSyncRun: overview?.latestSyncRun ?? null,
          documentCount: overview?.documentCount ?? 0,
          tagCount: overview?.tagCount ?? 0,
          linkCount: overview?.linkCount ?? 0,
        }
      } catch {
        return {
          ...source,
          persisted: false,
          latestSyncRun: null,
        }
      }
    }),
  )

  return (
    <div className="page-stack">
      <section className="hero compact-hero">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>动态知识平台管理台</h1>
          <p className="lead">这里用于初始化数据库、查看知识源状态，并通过管理台添加和同步 GitHub 知识源。</p>
        </div>
        <div className="hero-card">
          <span>当前阶段</span>
          <strong>数据库优先读写 + 本地源 + GitHub connector 第一版</strong>
        </div>
      </section>

      <AdminConsole configured={configured} dbStatus={dbStatus} sources={sourceStatuses} />
    </div>
  )
}
