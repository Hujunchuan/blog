"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useState, useTransition } from "react"

type AdminSyncRun = {
  id: string
  status: string
  started_at: string
  finished_at: string | null
  stats?: Record<string, unknown>
  error_message?: string | null
}

type AdminSourceStatus = {
  id: string
  name: string
  type: string
  location: string
  description?: string
  persisted: boolean
  latestSyncRun?: AdminSyncRun | null
  documentCount?: number
  tagCount?: number
  linkCount?: number
}

type GitHubSourceForm = {
  name: string
  location: string
  branch: string
  description: string
  tokenEnv: string
}

type ApiPayload = {
  status?: string
  message?: string
}

type SyncPayload = ApiPayload & {
  sourceId?: string
  syncRunId?: string
  documentCount?: number
  entityCount?: number
  relationCount?: number
}

const emptyGitHubForm: GitHubSourceForm = {
  name: "",
  location: "",
  branch: "main",
  description: "",
  tokenEnv: "",
}

async function callApi<T extends ApiPayload>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => ({}))) as T
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with ${response.status}`)
  }

  return payload
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "暂无"
  }

  return new Date(value).toLocaleString("zh-CN")
}

function formatStat(value: unknown) {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  return 0
}

function syncStatusLabel(status?: string) {
  switch (status) {
    case "success":
      return "成功"
    case "failed":
      return "失败"
    case "running":
      return "进行中"
    default:
      return "暂无"
  }
}

export function AdminConsole({
  configured,
  dbStatus,
  sources,
}: {
  configured: boolean
  dbStatus: string
  sources: AdminSourceStatus[]
}) {
  const router = useRouter()
  const [message, setMessage] = useState<string>()
  const [pendingAction, startTransition] = useTransition()
  const [gitHubForm, setGitHubForm] = useState<GitHubSourceForm>(emptyGitHubForm)
  const [lastSyncResult, setLastSyncResult] = useState<
    | {
        sourceId: string
        syncRunId: string
        documentCount: number
        entityCount: number
        relationCount: number
        completedAt: string
      }
    | undefined
  >()

  const runAction = <T extends ApiPayload>(
    label: string,
    action: () => Promise<T>,
    onSuccess?: (payload: T) => void,
  ) => {
    startTransition(async () => {
      try {
        setMessage(`${label}处理中...`)
        const payload = await action()
        onSuccess?.(payload)
        setMessage(`${label}已完成`)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `${label}失败`)
      }
    })
  }

  const handleAddGitHubSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runAction("添加 GitHub 知识源", async () => {
      await callApi("/api/admin/sources", {
        method: "POST",
        body: JSON.stringify({
          type: "github",
          name: gitHubForm.name.trim(),
          location: gitHubForm.location.trim(),
          branch: gitHubForm.branch.trim(),
          description: gitHubForm.description.trim(),
          tokenEnv: gitHubForm.tokenEnv.trim(),
        }),
      })
      setGitHubForm(emptyGitHubForm)
      return { status: "ok" }
    })
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>运行管理</h2>
          <p>这里用于初始化数据库、管理知识源，并查看最新同步结果。</p>
        </div>
        <div className="admin-actions">
          <button
            type="button"
            disabled={pendingAction || !configured}
            onClick={() =>
              runAction("初始化数据库", async () => callApi("/api/admin/db/init", { method: "POST" }))
            }
          >
            初始化数据库
          </button>
        </div>
      </div>

      <div className="admin-status-grid">
        <article className="result-card">
          <h3>数据库</h3>
          <p>配置状态：{configured ? "已配置" : "未配置"}</p>
          <small>健康状态：{dbStatus}</small>
        </article>
        <article className="result-card">
          <h3>同步方式</h3>
          <p>本地知识源可通过 `npm run watch:sources` 持续同步到 PostgreSQL。</p>
          <small>GitHub 知识源当前采用 mirror + 手动同步模式。</small>
        </article>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>添加 GitHub 知识源</h2>
            <p>先支持 public repo；private repo 可选填写 token 环境变量名。</p>
          </div>
        </div>

        <form className="analysis-form" onSubmit={handleAddGitHubSource}>
          <label>
            名称
            <input
              type="text"
              value={gitHubForm.name}
              onChange={(event) => setGitHubForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="例如：胡峻川知识库"
              required
            />
          </label>
          <label>
            仓库地址
            <input
              type="text"
              value={gitHubForm.location}
              onChange={(event) => setGitHubForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="例如：Hujunchuan/HuJunchuanKnowledgeBase"
              required
            />
          </label>
          <label>
            分支
            <input
              type="text"
              value={gitHubForm.branch}
              onChange={(event) => setGitHubForm((current) => ({ ...current, branch: event.target.value }))}
              placeholder="main"
            />
          </label>
          <label>
            描述
            <input
              type="text"
              value={gitHubForm.description}
              onChange={(event) => setGitHubForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="GitHub 知识源"
            />
          </label>
          <label>
            Token 环境变量
            <input
              type="text"
              value={gitHubForm.tokenEnv}
              onChange={(event) => setGitHubForm((current) => ({ ...current, tokenEnv: event.target.value }))}
              placeholder="private repo 时可填 GITHUB_TOKEN"
            />
          </label>
          <button type="submit" disabled={pendingAction}>
            添加 GitHub 知识源
          </button>
        </form>
      </section>

      {message ? <p className="admin-message">{message}</p> : null}

      {lastSyncResult ? (
        <article className="result-card sync-result-card">
          <div className="sync-result-header">
            <div>
              <h3>最近一次手动同步</h3>
              <p>{lastSyncResult.sourceId}</p>
            </div>
            <small>{formatTimestamp(lastSyncResult.completedAt)}</small>
          </div>
          <dl className="sync-stats">
            <div>
              <dt>Sync Run</dt>
              <dd>{lastSyncResult.syncRunId}</dd>
            </div>
            <div>
              <dt>文档</dt>
              <dd>{lastSyncResult.documentCount}</dd>
            </div>
            <div>
              <dt>实体</dt>
              <dd>{lastSyncResult.entityCount}</dd>
            </div>
            <div>
              <dt>关系</dt>
              <dd>{lastSyncResult.relationCount}</dd>
            </div>
          </dl>
        </article>
      ) : null}

      <div className="source-grid">
        {sources.map((source) => {
          const latestSyncRun = source.latestSyncRun ?? null
          const latestStats = latestSyncRun?.stats ?? {}

          return (
            <article className="source-card" key={source.id}>
              <div>
                <div className="source-card-header">
                  <span className="source-type">{source.type}</span>
                  <span className={`sync-status sync-status-${latestSyncRun?.status ?? "idle"}`}>
                    {syncStatusLabel(latestSyncRun?.status)}
                  </span>
                </div>
                <h3>{source.name}</h3>
                <p>{source.description ?? source.location}</p>
                <p>{source.location}</p>
              </div>

              <dl>
                <div>
                  <dt>持久化</dt>
                  <dd>{source.persisted ? "已同步" : "未同步"}</dd>
                </div>
                <div>
                  <dt>文档</dt>
                  <dd>{source.documentCount ?? 0}</dd>
                </div>
                <div>
                  <dt>标签</dt>
                  <dd>{source.tagCount ?? 0}</dd>
                </div>
              </dl>

              <div className="sync-run-summary">
                <p className="admin-meta">最近同步：{formatTimestamp(latestSyncRun?.finished_at ?? latestSyncRun?.started_at)}</p>
                {latestSyncRun ? (
                  <dl className="sync-inline-stats">
                    <div>
                      <dt>文档</dt>
                      <dd>{formatStat(latestStats.documentCount ?? source.documentCount)}</dd>
                    </div>
                    <div>
                      <dt>实体</dt>
                      <dd>{formatStat(latestStats.entityCount)}</dd>
                    </div>
                    <div>
                      <dt>关系</dt>
                      <dd>{formatStat(latestStats.relationCount)}</dd>
                    </div>
                  </dl>
                ) : null}
                {latestSyncRun?.error_message ? (
                  <p className="sync-error">最近失败原因：{latestSyncRun.error_message}</p>
                ) : null}
              </div>

              <div className="admin-actions">
                <button
                  type="button"
                  disabled={pendingAction || !configured}
                  onClick={() =>
                    runAction<SyncPayload>(
                      `同步 ${source.name}`,
                      async () => callApi<SyncPayload>(`/api/admin/source/${source.id}/persist`, { method: "POST" }),
                      (payload) => {
                        if (payload.sourceId && payload.syncRunId) {
                          setLastSyncResult({
                            sourceId: payload.sourceId,
                            syncRunId: payload.syncRunId,
                            documentCount: payload.documentCount ?? 0,
                            entityCount: payload.entityCount ?? 0,
                            relationCount: payload.relationCount ?? 0,
                            completedAt: new Date().toISOString(),
                          })
                        }
                      },
                    )
                  }
                >
                  立即同步
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
