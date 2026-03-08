"use client"

import Link from "next/link"
import { useDeferredValue, useState } from "react"
import { KnowledgeGraphEdge, KnowledgeGraphMode, KnowledgeGraphNode } from "@repo/core/types"

const palette = ["#174c5b", "#b7793f", "#4c6a2d", "#7d4d63", "#6f5b2d", "#1f5f5b", "#7f3b2e"]

const groupLabels: Record<string, string> = {
  root: "\u6839\u76EE\u5F55",
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

type GraphScope = "all" | "local"
type LocalDepth = 1 | 2

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

function toggleGroup(activeGroups: string[], group: string) {
  return activeGroups.includes(group) ? activeGroups.filter((item) => item !== group) : [...activeGroups, group]
}

function buildAdjacency(edges: KnowledgeGraphEdge[], allowedIds: Set<string>) {
  const adjacency = new Map<string, Set<string>>()

  for (const edge of edges) {
    if (!allowedIds.has(edge.source) || !allowedIds.has(edge.target)) {
      continue
    }

    const outgoing = adjacency.get(edge.source) ?? new Set<string>()
    outgoing.add(edge.target)
    adjacency.set(edge.source, outgoing)

    const incoming = adjacency.get(edge.target) ?? new Set<string>()
    incoming.add(edge.source)
    adjacency.set(edge.target, incoming)
  }

  return adjacency
}

function collectNeighborhood(
  anchorId: string | undefined,
  adjacency: Map<string, Set<string>>,
  maxDepth: LocalDepth,
) {
  if (!anchorId) {
    return undefined
  }

  const visible = new Set<string>([anchorId])
  const queue: Array<{ id: string; depth: number }> = [{ id: anchorId, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) {
      continue
    }

    for (const nextId of adjacency.get(current.id) ?? []) {
      if (!visible.has(nextId)) {
        visible.add(nextId)
        queue.push({ id: nextId, depth: current.depth + 1 })
      }
    }
  }

  return visible
}

function buildMatchedNodeIds(nodes: KnowledgeGraphNode[], query: string, focus?: string) {
  const normalizedQuery = query.trim().toLowerCase()
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

  return matched
}

function buildVisibleNodeIds(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  query: string,
  focus: string | undefined,
  activeGroups: string[],
  scope: GraphScope,
  localDepth: LocalDepth,
  selectedNodeId: string | undefined,
) {
  const activeGroupSet = new Set(activeGroups)
  const groupScopedNodes = nodes.filter((node) => activeGroupSet.has(node.group))
  const groupScopedIds = new Set(groupScopedNodes.map((node) => node.id))

  if (groupScopedNodes.length === 0) {
    return new Set<string>()
  }

  const adjacency = buildAdjacency(edges, groupScopedIds)
  const anchorId = selectedNodeId ?? focus ?? groupScopedNodes[0]?.id
  const localIds = scope === "local" ? collectNeighborhood(anchorId, adjacency, localDepth) : undefined
  const scopedNodes = localIds ? groupScopedNodes.filter((node) => localIds.has(node.id)) : groupScopedNodes

  const matched = buildMatchedNodeIds(scopedNodes, query, focus)
  if (query.trim() || focus) {
    if (matched.size === 0) {
      return new Set<string>()
    }

    const visible = new Set<string>(matched)
    for (const edge of edges) {
      if (!groupScopedIds.has(edge.source) || !groupScopedIds.has(edge.target)) {
        continue
      }
      if (localIds && (!localIds.has(edge.source) || !localIds.has(edge.target))) {
        continue
      }

      if (matched.has(edge.source)) {
        visible.add(edge.target)
      }
      if (matched.has(edge.target)) {
        visible.add(edge.source)
      }
    }

    return visible
  }

  return new Set(scopedNodes.map((node) => node.id))
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
  const allGroups = [...new Set(graph.nodes.map((node) => node.group))].sort((a, b) => a.localeCompare(b, "zh-CN"))
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<GraphScope>("all")
  const [localDepth, setLocalDepth] = useState<LocalDepth>(1)
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(initialFocus)
  const [activeGroups, setActiveGroups] = useState<string[]>(allGroups)
  const deferredQuery = useDeferredValue(query)

  const visibleIds = buildVisibleNodeIds(
    graph.nodes,
    graph.edges,
    deferredQuery,
    initialFocus,
    activeGroups,
    scope,
    localDepth,
    selectedNodeId,
  )

  const visibleNodes = graph.nodes.filter((node) => visibleIds.has(node.id))
  const visibleNodeIdSet = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = graph.edges.filter((edge) => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target))
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
        .slice(0, 12)
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
              placeholder="\u641C\u7D22\u8282\u70B9\u540D\u79F0\u3001\u5206\u7EC4\u6216 entity key"
            />
          </div>
          <div className="badge-row">
            <span className="badge">{`\u53EF\u89C1\u8282\u70B9 ${visibleNodes.length}`}</span>
            <span className="badge">{`\u53EF\u89C1\u8FB9 ${visibleEdges.length}`}</span>
            <span className="badge">{`\u5206\u7EC4 ${new Set(visibleNodes.map((node) => node.group)).size}`}</span>
          </div>
        </div>

        <div className="graph-controls">
          <div className="graph-control-group">
            <span className="graph-control-label">{"\u89C6\u56FE\u8303\u56F4"}</span>
            <div className="graph-pill-row">
              <button
                type="button"
                className="graph-pill"
                data-active={scope === "all"}
                onClick={() => setScope("all")}
              >
                {"\u5168\u56FE"}
              </button>
              <button
                type="button"
                className="graph-pill"
                data-active={scope === "local"}
                onClick={() => setScope("local")}
              >
                {"\u5C40\u90E8\u90BB\u57DF"}
              </button>
            </div>
          </div>

          <div className="graph-control-group">
            <span className="graph-control-label">{"\u5C40\u90E8\u6DF1\u5EA6"}</span>
            <div className="graph-pill-row">
              <button
                type="button"
                className="graph-pill"
                data-active={localDepth === 1}
                onClick={() => setLocalDepth(1)}
              >
                {"1 \u8DF3"}
              </button>
              <button
                type="button"
                className="graph-pill"
                data-active={localDepth === 2}
                onClick={() => setLocalDepth(2)}
              >
                {"2 \u8DF3"}
              </button>
            </div>
          </div>

          <div className="graph-control-group graph-control-grow">
            <span className="graph-control-label">{"\u5206\u7EC4\u7B5B\u9009"}</span>
            <div className="graph-pill-row">
              {allGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  className="graph-pill"
                  data-active={activeGroups.includes(group)}
                  onClick={() => setActiveGroups((current) => toggleGroup(current, group))}
                >
                  {groupLabel(group)}
                </button>
              ))}
              <button type="button" className="graph-pill" data-active="false" onClick={() => setActiveGroups(allGroups)}>
                {"\u91CD\u7F6E"}
              </button>
            </div>
          </div>
        </div>

        <div className="graph-canvas-shell">
          {visibleNodes.length === 0 ? (
            <div className="empty-state">{"\u6CA1\u6709\u547D\u4E2D\u8282\u70B9\uFF0C\u53EF\u4EE5\u6362\u4E2A\u5173\u952E\u8BCD\u6216\u91CD\u7F6E\u7B5B\u9009\u3002"}</div>
          ) : (
            <svg className="graph-canvas" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img">
              {visibleEdges.map((edge) => {
                const source = positionedMap.get(edge.source)
                const target = positionedMap.get(edge.target)
                if (!source || !target) {
                  return null
                }

                const highlighted =
                  selectedNode !== undefined &&
                  (edge.source === selectedNode.id || edge.target === selectedNode.id)

                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    className="graph-edge"
                    data-highlighted={highlighted}
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
              <h2>{"\u8282\u70B9\u8BE6\u60C5"}</h2>
              <p>{"\u70B9\u51FB\u56FE\u8C31\u4E2D\u7684\u8282\u70B9\u53EF\u4EE5\u805A\u7126\u3001\u8DF3\u8F6C\u6216\u67E5\u770B\u90BB\u57DF\u3002"}</p>
            </div>
          </div>
          {selectedNode ? (
            <div className="page-stack">
              <div className="result-card">
                <h3>{selectedNode.label}</h3>
                <p>{`\u5206\u7EC4: ${groupLabel(selectedNode.group)}`}</p>
                <div className="badge-row">
                  <span className="badge">{`\u8FDE\u63A5\u6570 ${degreeMap.get(selectedNode.id) ?? 0}`}</span>
                  <span className="badge">{`\u6743\u91CD ${selectedNode.weight}`}</span>
                </div>
                <div className="action-row">
                  <Link href={graphFocusHref(sourceId, mode, selectedNode)} className="ghost-link" prefetch={false}>
                    {"\u56FA\u5B9A\u5230\u5F53\u524D\u8282\u70B9"}
                  </Link>
                  {selectedNodeHref && (
                    <Link href={selectedNodeHref} className="ghost-link" prefetch={false}>
                      {mode === "knowledge" ? "\u6253\u5F00\u77E5\u8BC6\u5206\u6790" : "\u6253\u5F00\u6587\u6863"}
                    </Link>
                  )}
                  <button type="button" className="graph-inline-button" onClick={() => setScope("local")}>
                    {"\u53EA\u770B\u8FD9\u4E2A\u8282\u70B9\u7684\u90BB\u57DF"}
                  </button>
                </div>
              </div>

              <div className="result-card">
                <h3>{"\u8282\u70B9\u6807\u8BC6"}</h3>
                <p>{selectedNode.entityKey ?? selectedNode.slug ?? selectedNode.id}</p>
              </div>

              <div className="result-card">
                <h3>{"\u76F8\u90BB\u8282\u70B9"}</h3>
                <div className="result-list">
                  {selectedNeighbors.map((node) => (
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
                  {selectedNeighbors.length === 0 && (
                    <div className="empty-state">{"\u5F53\u524D\u8282\u70B9\u5728\u53EF\u89C1\u8303\u56F4\u5185\u6CA1\u6709\u76F8\u90BB\u8282\u70B9\u3002"}</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">{"\u5F53\u524D\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u8282\u70B9\u3002"}</div>
          )}
        </section>
      </aside>
    </div>
  )
}
