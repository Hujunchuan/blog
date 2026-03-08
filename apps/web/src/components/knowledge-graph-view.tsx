"use client"

import Link from "next/link"
import { useDeferredValue, useState } from "react"
import { KnowledgeGraphEdge, KnowledgeGraphMode, KnowledgeGraphNode } from "@repo/core/types"

const palette = ["#174c5b", "#b7793f", "#4c6a2d", "#7d4d63", "#6f5b2d", "#1f5f5b", "#7f3b2e"]

const groupLabels: Record<string, string> = {
  root: "根目录",
  document: "文档",
  tag: "标签",
  concept: "概念",
  person: "人物",
  project: "项目",
  meeting: "会议",
  decision: "决策",
  task: "任务",
  practice: "实践",
}

function hashValue(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function colorForGroup(group: string) {
  return palette[hashValue(group) % palette.length]
}

function encodeSlug(slug: string) {
  return slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function graphNodeHref(sourceId: string, mode: KnowledgeGraphMode, node: KnowledgeGraphNode) {
  if (mode === "knowledge") {
    if (node.entityKey) {
      return `/source/${encodeURIComponent(sourceId)}/knowledge?entityKey=${encodeURIComponent(node.entityKey)}`
    }
    if (node.slug) {
      return `/source/${encodeURIComponent(sourceId)}/knowledge?slug=${encodeURIComponent(node.slug)}`
    }
    return undefined
  }

  if (node.slug) {
    return `/source/${encodeURIComponent(sourceId)}/doc/${encodeSlug(node.slug)}`
  }

  return undefined
}

function graphFocusHref(sourceId: string, mode: KnowledgeGraphMode, node: KnowledgeGraphNode) {
  const params = new URLSearchParams()
  params.set("mode", mode)
  params.set("focus", node.id)
  return `/source/${encodeURIComponent(sourceId)}/graph?${params.toString()}`
}

function groupLabel(group: string) {
  return groupLabels[group] ?? group
}

function buildVisibleNodeIds(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  query: string,
  focus?: string,
) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery && !focus) {
    return new Set(nodes.map((node) => node.id))
  }

  const matched = new Set<string>()
  for (const node of nodes) {
    const haystack = `${node.label} ${node.group} ${node.slug ?? ""} ${node.entityKey ?? ""}`.toLowerCase()
    if (!normalizedQuery || haystack.includes(normalizedQuery)) {
      matched.add(node.id)
    }
  }

  if (focus) {
    matched.add(focus)
  }

  if (matched.size === 0) {
    return new Set<string>()
  }

  const visible = new Set(matched)
  for (const edge of edges) {
    if (matched.has(edge.source)) {
      visible.add(edge.target)
    }
    if (matched.has(edge.target)) {
      visible.add(edge.source)
    }
  }

  return visible
}

type PositionedNode = KnowledgeGraphNode & {
  x: number
  y: number
  radius: number
  color: string
}

function layoutNodes(nodes: KnowledgeGraphNode[]) {
  const width = 1040
  const height = 620
  const grouped = new Map<string, KnowledgeGraphNode[]>()

  for (const node of nodes) {
    const bucket = grouped.get(node.group) ?? []
    bucket.push(node)
    grouped.set(node.group, bucket)
  }

  const groups = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-CN"))
  const centerX = width / 2
  const centerY = height / 2
  const orbitX = Math.max(150, width * 0.32)
  const orbitY = Math.max(130, height * 0.28)
  const positioned: PositionedNode[] = []

  groups.forEach(([group, groupNodes], groupIndex) => {
    const angle = (Math.PI * 2 * groupIndex) / Math.max(groups.length, 1) - Math.PI / 2
    const groupCenterX = groups.length === 1 ? centerX : centerX + Math.cos(angle) * orbitX
    const groupCenterY = groups.length === 1 ? centerY : centerY + Math.sin(angle) * orbitY
    const sortedNodes = [...groupNodes].sort(
      (a, b) => b.weight - a.weight || a.label.localeCompare(b.label, "zh-CN"),
    )

    sortedNodes.forEach((node, nodeIndex) => {
      if (nodeIndex === 0) {
        positioned.push({
          ...node,
          x: groupCenterX,
          y: groupCenterY,
          radius: 14 + Math.min(node.weight, 10) * 0.9,
          color: colorForGroup(group),
        })
        return
      }

      let remaining = nodeIndex - 1
      let ring = 1
      let slots = 6
      while (remaining >= slots) {
        remaining -= slots
        ring += 1
        slots = 6 + ring * 4
      }

      const nodeAngle = (Math.PI * 2 * remaining) / slots + angle * 0.25
      const nodeRadius = 34 + ring * 28
      positioned.push({
        ...node,
        x: groupCenterX + Math.cos(nodeAngle) * nodeRadius,
        y: groupCenterY + Math.sin(nodeAngle) * nodeRadius,
        radius: 9 + Math.min(node.weight, 10) * 0.7,
        color: colorForGroup(group),
      })
    })
  })

  return {
    width,
    height,
    nodes: positioned,
  }
}

export function KnowledgeGraphView({
  sourceId,
  mode,
  graph,
  initialFocus,
}: {
  sourceId: string
  mode: KnowledgeGraphMode
  graph: {
    nodes: KnowledgeGraphNode[]
    edges: KnowledgeGraphEdge[]
  }
  initialFocus?: string
}) {
  const [query, setQuery] = useState("")
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(initialFocus)
  const deferredQuery = useDeferredValue(query)

  const visibleIds = buildVisibleNodeIds(graph.nodes, graph.edges, deferredQuery, initialFocus)
  const visibleNodes = graph.nodes.filter((node) => visibleIds.has(node.id))
  const visibleEdges = graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
  const degreeMap = new Map<string, number>()
  for (const edge of visibleEdges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1)
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1)
  }

  const layout = layoutNodes(visibleNodes)
  const positionedMap = new Map(layout.nodes.map((node) => [node.id, node]))
  const selectedNode =
    visibleNodes.find((node) => node.id === selectedNodeId) ??
    visibleNodes.find((node) => node.id === initialFocus) ??
    visibleNodes[0]
  const selectedNodeHref = selectedNode ? graphNodeHref(sourceId, mode, selectedNode) : undefined
  const selectedNeighbors = selectedNode
    ? visibleEdges
        .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
        .map((edge) => {
          const peerId = edge.source === selectedNode.id ? edge.target : edge.source
          return visibleNodes.find((node) => node.id === peerId)
        })
        .filter((node): node is KnowledgeGraphNode => Boolean(node))
    : []

  return (
    <div className="graph-workspace">
      <div className="graph-stage">
        <div className="graph-toolbar">
          <div className="graph-search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索节点名称、目录、实体 key"
            />
          </div>
          <div className="badge-row">
            <span className="badge">{`可见节点 ${visibleNodes.length}`}</span>
            <span className="badge">{`可见边 ${visibleEdges.length}`}</span>
            <span className="badge">{`分组 ${new Set(visibleNodes.map((node) => node.group)).size}`}</span>
          </div>
        </div>

        <div className="graph-canvas-shell">
          {visibleNodes.length === 0 ? (
            <div className="empty-state">没有命中节点，换个关键词试试。</div>
          ) : (
            <svg className="graph-canvas" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img">
              {visibleEdges.map((edge) => {
                const source = positionedMap.get(edge.source)
                const target = positionedMap.get(edge.target)
                if (!source || !target) {
                  return null
                }

                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    className="graph-edge"
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                )
              })}
              {layout.nodes.map((node) => {
                const active = selectedNode?.id === node.id
                return (
                  <g
                    key={node.id}
                    className="graph-node"
                    data-active={active}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <circle cx={node.x} cy={node.y} r={node.radius} fill={node.color} />
                    <text x={node.x} y={node.y + node.radius + 14} textAnchor="middle">
                      {node.label.length > 12 ? `${node.label.slice(0, 12)}...` : node.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        <div className="graph-legend">
          {[...new Set(visibleNodes.map((node) => node.group))].sort((a, b) => a.localeCompare(b, "zh-CN")).map((group) => (
            <span key={group} className="badge">
              {groupLabel(group)}
            </span>
          ))}
        </div>
      </div>

      <aside className="graph-sidebar">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>节点详情</h2>
              <p>点击图谱中的任意节点查看详情和跳转入口。</p>
            </div>
          </div>
          {selectedNode ? (
            <div className="page-stack">
              <div className="result-card">
                <h3>{selectedNode.label}</h3>
                <p>{`分组: ${groupLabel(selectedNode.group)}`}</p>
                <div className="badge-row">
                  <span className="badge">{`连接数 ${degreeMap.get(selectedNode.id) ?? 0}`}</span>
                  <span className="badge">{`权重 ${selectedNode.weight}`}</span>
                </div>
                <div className="action-row">
                  <Link href={graphFocusHref(sourceId, mode, selectedNode)} className="ghost-link" prefetch={false}>
                    固定到当前节点
                  </Link>
                  {selectedNodeHref && (
                    <Link href={selectedNodeHref} className="ghost-link" prefetch={false}>
                      {mode === "knowledge" ? "打开知识分析" : "打开文档"}
                    </Link>
                  )}
                </div>
              </div>

              <div className="result-card">
                <h3>节点标识</h3>
                <p>{selectedNode.entityKey ?? selectedNode.slug ?? selectedNode.id}</p>
              </div>

              <div className="result-card">
                <h3>相邻节点</h3>
                <div className="result-list">
                  {selectedNeighbors.slice(0, 8).map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className="graph-node-button"
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      <span>{node.label}</span>
                      <small>{groupLabel(node.group)}</small>
                    </button>
                  ))}
                  {selectedNeighbors.length === 0 && <div className="empty-state">当前节点没有可见的相邻节点。</div>}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">当前没有可展示的节点。</div>
          )}
        </section>
      </aside>
    </div>
  )
}
