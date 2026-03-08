"use client"

import Link from "next/link"
import { PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react"
import { KnowledgeGraphEdge, KnowledgeGraphMode, KnowledgeGraphNode } from "@repo/core/types"

const palette = ["#5c6f7b", "#b7793f", "#58753f", "#7d4d63", "#496d8a", "#7a6540"]

type ViewTransform = {
  x: number
  y: number
  scale: number
}

type PanState = {
  pointerId: number
  startClientX: number
  startClientY: number
  originX: number
  originY: number
} | null

type PositionedNode = KnowledgeGraphNode & {
  x: number
  y: number
  radius: number
  depth: number
  color: string
}

const groupLabels: Record<string, string> = {
  root: "Root",
  document: "Document",
  tag: "Tag",
  concept: "Concept",
  person: "Person",
  project: "Project",
  meeting: "Meeting",
  decision: "Decision",
  task: "Task",
  practice: "Practice",
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

function edgeWeight(edge: KnowledgeGraphEdge) {
  return edge.weight ?? 1
}

function encodeSlug(slug: string) {
  return slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function documentHref(sourceId: string, slug: string) {
  return `/source/${encodeURIComponent(sourceId)}/doc/${encodeSlug(slug)}`
}

function analysisHref(sourceId: string, mode: KnowledgeGraphMode, node: KnowledgeGraphNode) {
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
    return documentHref(sourceId, node.slug)
  }

  return undefined
}

function buildAdjacency(edges: KnowledgeGraphEdge[], allowedIds: Set<string>) {
  const adjacency = new Map<string, Set<string>>()

  for (const edge of edges) {
    if (!allowedIds.has(edge.source) || !allowedIds.has(edge.target)) {
      continue
    }

    const sourceSet = adjacency.get(edge.source) ?? new Set<string>()
    sourceSet.add(edge.target)
    adjacency.set(edge.source, sourceSet)

    const targetSet = adjacency.get(edge.target) ?? new Set<string>()
    targetSet.add(edge.source)
    adjacency.set(edge.target, targetSet)
  }

  return adjacency
}

function buildDepthMap(anchorId: string, adjacency: Map<string, Set<string>>, maxDepth: number) {
  const depthMap = new Map<string, number>([[anchorId, 0]])
  const queue: Array<{ id: string; depth: number }> = [{ id: anchorId, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) {
      continue
    }

    for (const nextId of adjacency.get(current.id) ?? []) {
      if (depthMap.has(nextId)) {
        continue
      }
      depthMap.set(nextId, current.depth + 1)
      queue.push({ id: nextId, depth: current.depth + 1 })
    }
  }

  return depthMap
}

function buildDegreeMap(edges: KnowledgeGraphEdge[]) {
  const degrees = new Map<string, number>()

  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
  }

  return degrees
}

function rankNodes(
  nodes: KnowledgeGraphNode[],
  depthMap: Map<string, number>,
  degreeMap: Map<string, number>,
  focusNodeId: string,
) {
  return [...nodes].sort((left, right) => {
    const leftFocus = left.id === focusNodeId ? 1 : 0
    const rightFocus = right.id === focusNodeId ? 1 : 0
    if (leftFocus !== rightFocus) {
      return rightFocus - leftFocus
    }

    const leftDepth = depthMap.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightDepth = depthMap.get(right.id) ?? Number.MAX_SAFE_INTEGER
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth
    }

    const degreeDelta = (degreeMap.get(right.id) ?? 0) - (degreeMap.get(left.id) ?? 0)
    if (degreeDelta !== 0) {
      return degreeDelta
    }

    if (left.weight !== right.weight) {
      return right.weight - left.weight
    }

    return left.label.localeCompare(right.label, "zh-CN")
  })
}

function buildCompactGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  focusNodeId: string,
  depth: 1 | 2,
) {
  const width = 960
  const height = 560
  const centerX = width / 2
  const centerY = height / 2
  const allNodeIds = new Set(nodes.map((node) => node.id))
  const adjacency = buildAdjacency(edges, allNodeIds)
  const fullDepthMap = buildDepthMap(focusNodeId, adjacency, depth)
  const visibleNodes = nodes.filter((node) => fullDepthMap.has(node.id))
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
  )
  const degreeMap = buildDegreeMap(visibleEdges)
  const rankedNodes = rankNodes(visibleNodes, fullDepthMap, degreeMap, focusNodeId)
  const maxNodeCount = depth === 1 ? 32 : 60
  const keptIds = new Set(rankedNodes.slice(0, maxNodeCount).map((node) => node.id))
  keptIds.add(focusNodeId)

  const limitedNodes = visibleNodes.filter((node) => keptIds.has(node.id))
  const limitedNodeIds = new Set(limitedNodes.map((node) => node.id))
  const limitedEdges = visibleEdges
    .filter((edge) => limitedNodeIds.has(edge.source) && limitedNodeIds.has(edge.target))
    .sort((left, right) => {
      const leftFocus = left.source === focusNodeId || left.target === focusNodeId ? 1 : 0
      const rightFocus = right.source === focusNodeId || right.target === focusNodeId ? 1 : 0
      if (leftFocus !== rightFocus) {
        return rightFocus - leftFocus
      }
      return edgeWeight(right) - edgeWeight(left)
    })
    .slice(0, depth === 1 ? 80 : 140)
  const compactAdjacency = buildAdjacency(limitedEdges, limitedNodeIds)
  const depthMap = buildDepthMap(focusNodeId, compactAdjacency, depth)

  const focusNode = limitedNodes.find((node) => node.id === focusNodeId)
  const positioned: PositionedNode[] = []
  if (focusNode) {
    positioned.push({
      ...focusNode,
      x: centerX,
      y: centerY,
      radius: 13 + Math.min(focusNode.weight, 10) * 0.45,
      depth: 0,
      color: colorForGroup(focusNode.group),
    })
  }

  for (const ringDepth of [1, 2] as const) {
    if (ringDepth > depth) {
      continue
    }

    const ringNodes = limitedNodes
      .filter((node) => (depthMap.get(node.id) ?? Number.MAX_SAFE_INTEGER) === ringDepth)
      .sort((left, right) => {
        const degreeDelta = (degreeMap.get(right.id) ?? 0) - (degreeMap.get(left.id) ?? 0)
        if (degreeDelta !== 0) {
          return degreeDelta
        }
        return right.weight - left.weight
      })

    const count = Math.max(ringNodes.length, 1)
    const radiusX = ringDepth === 1 ? 180 : 320
    const radiusY = ringDepth === 1 ? 120 : 210

    ringNodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
        radius: (ringDepth === 1 ? 8 : 6) + Math.min(node.weight, 10) * (ringDepth === 1 ? 0.35 : 0.24),
        depth: ringDepth,
        color: colorForGroup(node.group),
      })
    })
  }

  return {
    width,
    height,
    nodes: positioned,
    edges: limitedEdges,
    degreeMap,
    adjacency: compactAdjacency,
  }
}

function clampScale(scale: number) {
  return Math.min(2.6, Math.max(0.7, scale))
}

function graphPointFromClient(
  container: HTMLDivElement,
  width: number,
  height: number,
  clientX: number,
  clientY: number,
) {
  const rect = container.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / rect.width) * width,
    y: ((clientY - rect.top) / rect.height) * height,
  }
}

export function QuartzGraphView({
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const defaultFocusNodeId = useMemo(() => {
    const explicit = initialFocus && graph.nodes.find((node) => node.id === initialFocus)?.id
    if (explicit) {
      return explicit
    }

    return [...graph.nodes]
      .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label, "zh-CN"))[0]?.id
  }, [graph.nodes, initialFocus])
  const [focusNodeId, setFocusNodeId] = useState<string | undefined>(defaultFocusNodeId)
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(defaultFocusNodeId)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>()
  const [depth, setDepth] = useState<1 | 2>(1)
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 })
  const [panState, setPanState] = useState<PanState>(null)

  useEffect(() => {
    if (!focusNodeId && defaultFocusNodeId) {
      setFocusNodeId(defaultFocusNodeId)
    }
    if (!selectedNodeId && defaultFocusNodeId) {
      setSelectedNodeId(defaultFocusNodeId)
    }
  }, [defaultFocusNodeId, focusNodeId, selectedNodeId])

  useEffect(() => {
    if (!initialFocus) {
      return
    }
    if (graph.nodes.some((node) => node.id === initialFocus)) {
      setFocusNodeId(initialFocus)
      setSelectedNodeId(initialFocus)
    }
  }, [graph.nodes, initialFocus])

  const compactGraph = useMemo(() => {
    if (!focusNodeId) {
      return undefined
    }
    return buildCompactGraph(graph.nodes, graph.edges, focusNodeId, depth)
  }, [depth, focusNodeId, graph.edges, graph.nodes])

  const positionedMap = useMemo(
    () => new Map(compactGraph?.nodes.map((node) => [node.id, node]) ?? []),
    [compactGraph],
  )

  const selectedNode = compactGraph?.nodes.find((node) => node.id === selectedNodeId) ?? compactGraph?.nodes[0]
  const activeNodeId = hoveredNodeId ?? selectedNode?.id
  const activeNeighbors = useMemo(
    () => (activeNodeId && compactGraph ? compactGraph.adjacency.get(activeNodeId) ?? new Set<string>() : new Set<string>()),
    [activeNodeId, compactGraph],
  )

  const selectedConnections = useMemo(() => {
    if (!selectedNode || !compactGraph) {
      return []
    }

    return compactGraph.edges
      .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
      .map((edge) => {
        const peerId = edge.source === selectedNode.id ? edge.target : edge.source
        return {
          edge,
          peer: positionedMap.get(peerId),
        }
      })
      .filter((item): item is { edge: KnowledgeGraphEdge; peer: PositionedNode } => Boolean(item.peer))
      .sort((left, right) => {
        const weightDelta = edgeWeight(right.edge) - edgeWeight(left.edge)
        if (weightDelta !== 0) {
          return weightDelta
        }
        return left.peer.label.localeCompare(right.peer.label, "zh-CN")
      })
      .slice(0, 8)
  }, [compactGraph, positionedMap, selectedNode])

  if (!compactGraph || compactGraph.nodes.length === 0) {
    return <div className="empty-state">No graph data available.</div>
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (!containerRef.current) {
      return
    }

    const point = graphPointFromClient(
      containerRef.current,
      compactGraph.width,
      compactGraph.height,
      event.clientX,
      event.clientY,
    )
    const nextScale = clampScale(view.scale * (event.deltaY < 0 ? 1.08 : 0.92))
    const worldX = (point.x - view.x) / view.scale
    const worldY = (point.y - view.y) / view.scale

    setView({
      scale: nextScale,
      x: point.x - worldX * nextScale,
      y: point.y - worldY * nextScale,
    })
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest("[data-node-id]")) {
      return
    }

    setPanState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: view.x,
      originY: view.y,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!panState || event.pointerId !== panState.pointerId) {
      return
    }

    setView((current) => ({
      ...current,
      x: panState.originX + (event.clientX - panState.startClientX),
      y: panState.originY + (event.clientY - panState.startClientY),
    }))
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!panState || event.pointerId !== panState.pointerId) {
      return
    }
    setPanState(null)
  }

  return (
    <div className="lite-graph">
      <div className="lite-graph-toolbar">
        <div className="badge-row">
          <span className="badge">{`${compactGraph.nodes.length} nodes`}</span>
          <span className="badge">{`${compactGraph.edges.length} edges`}</span>
          <span className="badge">{depth === 1 ? "1 hop" : "2 hops"}</span>
        </div>
        <div className="graph-pill-row">
          <button type="button" className="graph-pill" data-active={depth === 1} onClick={() => setDepth(1)}>
            1 hop
          </button>
          <button type="button" className="graph-pill" data-active={depth === 2} onClick={() => setDepth(2)}>
            2 hops
          </button>
          <button
            type="button"
            className="graph-pill"
            data-active="false"
            onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          >
            Reset view
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="lite-graph-shell"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <svg
          className="lite-graph-canvas"
          viewBox={`0 0 ${compactGraph.width} ${compactGraph.height}`}
          role="img"
          aria-label="Local knowledge graph"
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            {compactGraph.edges.map((edge, index) => {
              const source = positionedMap.get(edge.source)
              const target = positionedMap.get(edge.target)
              if (!source || !target) {
                return null
              }

              const active = activeNodeId && (edge.source === activeNodeId || edge.target === activeNodeId)
              return (
                <line
                  key={`${edge.source}-${edge.target}-${index}`}
                  className="lite-graph-edge"
                  data-active={active ? "true" : "false"}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                />
              )
            })}

            {compactGraph.nodes.map((node) => {
              const active = activeNodeId === node.id
              const neighbor = activeNeighbors.has(node.id)
              const dimmed = Boolean(activeNodeId) && !active && !neighbor

              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  className="lite-graph-node"
                  data-active={active ? "true" : "false"}
                  data-dimmed={dimmed ? "true" : "false"}
                  transform={`translate(${node.x} ${node.y})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(undefined)}
                  onClick={() => setSelectedNodeId(node.id)}
                  onDoubleClick={() => {
                    setFocusNodeId(node.id)
                    setSelectedNodeId(node.id)
                  }}
                >
                  <circle r={node.radius} fill={node.color} />
                  <text dy={node.radius + 14} textAnchor="middle">
                    {node.label.length > 16 ? `${node.label.slice(0, 16)}...` : node.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {selectedNode && (
        <div className="lite-graph-meta">
          <div className="result-card">
            <h3>{selectedNode.label}</h3>
            <p>{groupLabels[selectedNode.group] ?? selectedNode.group}</p>
            <div className="badge-row">
              <span className="badge">{`degree ${compactGraph.degreeMap.get(selectedNode.id) ?? 0}`}</span>
              <span className="badge">{`weight ${selectedNode.weight}`}</span>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="graph-inline-button"
                onClick={() => {
                  setFocusNodeId(selectedNode.id)
                  setSelectedNodeId(selectedNode.id)
                }}
              >
                Center here
              </button>
              {analysisHref(sourceId, mode, selectedNode) && (
                <Link href={analysisHref(sourceId, mode, selectedNode)!} className="ghost-link" prefetch={false}>
                  Open node
                </Link>
              )}
            </div>
          </div>

          <div className="result-card">
            <h3>Nearby</h3>
            <div className="result-list">
              {selectedConnections.map(({ edge, peer }) => (
                <button
                  key={`${selectedNode.id}-${peer.id}`}
                  type="button"
                  className="graph-node-button"
                  onClick={() => setSelectedNodeId(peer.id)}
                  onDoubleClick={() => {
                    setFocusNodeId(peer.id)
                    setSelectedNodeId(peer.id)
                  }}
                >
                  <strong>{peer.label}</strong>
                  <small>{`${groupLabels[peer.group] ?? peer.group} · weight ${edgeWeight(edge)}`}</small>
                </button>
              ))}
              {selectedConnections.length === 0 && <div className="empty-state">No visible neighbors.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
