"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useState, useTransition } from "react"

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

  const runAction = (label: string, action: () => Promise<void>) => {
    startTransition(async () => {
      try {
        setMessage(`${label}处理中...`)
        await action()
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
    })
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>运行管理</h2>
          <p>这里用于初始化数据库、管理知识源，并触发手动同步。</p>
        </div>
        <div className="admin-actions">
          <button
            type="button"
            disabled={pendingAction || !configured}
            onClick={() =>
              runAction("初始化数据库", async () => {
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

            <p className="admin-meta">最近同步：{formatTimestamp(source.latestSyncRun?.finished_at)}</p>

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
