"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

type AdminSourceStatus = {
  id: string
  name: string
  type: string
  location: string
  description?: string
  persisted: boolean
  latestSyncRun?: {
    id: string
    status: string
    started_at: string
    finished_at: string | null
  } | null
  documentCount?: number
  tagCount?: number
  linkCount?: number
}

async function callApi(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => ({}))) as { message?: string; status?: string }
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with ${response.status}`)
  }

  return payload
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

  const runAction = (label: string, action: () => Promise<void>) => {
    startTransition(async () => {
      try {
        setMessage(`${label}处理中...`)
        await action()
        setMessage(`${label}完成`)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `${label}失败`)
      }
    })
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>运行管理</h2>
          <p>当前管理页提供数据库初始化、单知识源同步和同步状态查看。</p>
        </div>
        <div className="admin-actions">
          <button
            type="button"
            disabled={pendingAction || !configured}
            onClick={() =>
              runAction("数据库初始化", async () => {
                await callApi("/api/admin/db/init", { method: "POST" })
              })
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
          <h3>自动同步</h3>
          <p>单独在终端运行 `npm run watch:sources` 即可监听本地知识源变更。</p>
          <small>推荐与 `npm run web:dev` 并行运行。</small>
        </article>
      </div>

      {message ? <p className="admin-message">{message}</p> : null}

      <div className="source-grid">
        {sources.map((source) => (
          <article className="source-card" key={source.id}>
            <div>
              <span className="source-type">{source.type}</span>
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
            <p className="admin-meta">
              最近同步：
              {source.latestSyncRun?.finished_at
                ? new Date(source.latestSyncRun.finished_at).toLocaleString("zh-CN")
                : "暂无"}
            </p>
            <div className="admin-actions">
              <button
                type="button"
                disabled={pendingAction || !configured}
                onClick={() =>
                  runAction(`同步 ${source.name}`, async () => {
                    await callApi(`/api/admin/source/${source.id}/persist`, { method: "POST" })
                  })
                }
              >
                立即同步
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
