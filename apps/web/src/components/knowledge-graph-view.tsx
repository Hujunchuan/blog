"use client"

import Link from "next/link"
import { PointerEvent, useDeferredValue, useEffect, useRef, useState } from "react"
import {
  KnowledgeEvidenceResult,
  KnowledgeGraphEdge,
  KnowledgeGraphMode,
  KnowledgeGraphNode,
  KnowledgeRelationType,
} from "@repo/core/types"

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

const relationLabels: Record<KnowledgeRelationType, string> = {
  mentions: "提及",
  references: "引用",
  explains: "解释",
  belongs_to: "归属",
  derived_from: "派生",
  decides: "决策",
  supports: "支持",
  contradicts: "冲突",
  related_to: "关联",
  next_step_for: "下一步",
}

type GraphScope = "all" | "local"
type LocalDepth = 1 | 2
type CollapseMode = "none" | "leaf" | "low-signal"
type NodePosition = { x: number; y: number }
type DragState = {
  nodeId: string
  pointerId: number
  offsetX: number
  offsetY: number
} | null

type PositionedNode = KnowledgeGraphNode & {
  x: number
  y: number
  radius: number
  color: string
}

type SelectedConnection = {
  edge: KnowledgeGraphEdge
  peer: KnowledgeGraphNode
  direction: "incoming" | "outgoing"
}

type CountSummary = {
  key: string
  count: number
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

function documentHref(sourceId: string, slug: string) {
  return `/source/${encodeURIComponent(sourceId)}/doc/${encodeSlug(slug)}`
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
    return documentHref(sourceId, node.slug)
  }

  return undefined
}

function graphFocusHref(sourceId: string, mode: KnowledgeGraphMode, node: KnowledgeGraphNode) {
  const params = new URLSearchParams()
  params.set("mode", mode)
  params.set("focus", node.id)
  return `/source/${encodeURIComponent(sourceId)}/graph?${params.toString()}`
}

function relationLabel(relationType: string) {
  return relationLabels[relationType as KnowledgeRelationType] ?? relationType
}

function groupLabel(group: string) {
  return groupLabels[group] ?? group
}

function toggleSelection(activeItems: string[], item: string) {
  return activeItems.includes(item) ? activeItems.filter((candidate) => candidate !== item) : [...activeItems, item]
}

function edgeRelationTypes(edge: KnowledgeGraphEdge) {
  return edge.relationTypes && edge.relationTypes.length > 0 ? edge.relationTypes : ["references"]
}

function edgeEvidenceSlugs(edge: KnowledgeGraphEdge) {
  return edge.evidenceDocumentSlugs ?? []
}

function edgeWeight(edge: KnowledgeGraphEdge) {
  return edge.weight ?? 1
}

function buildCountSummary(values: string[]): CountSummary[] {
  const counts = new Map<string, number>()

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "zh-CN"))
}

function evidenceNodeKey(node: KnowledgeGraphNode | undefined) {
  if (!node) {
    return undefined
  }

  if (node.entityKey) {
    return `entity:${node.entityKey}`
  }

  if (node.slug) {
    return `slug:${node.slug}`
  }

  return undefined
}

function formatGraphDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10)
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed)
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

function buildDegreeMap(edges: KnowledgeGraphEdge[]) {
  const degreeMap = new Map<string, number>()

  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1)
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1)
  }

  return degreeMap
}

function buildDepthMap(anchorId: string | undefined, adjacency: Map<string, Set<string>>, maxDepth: number) {
  const depthMap = new Map<string, number>()

  if (!anchorId) {
    return depthMap
  }

  depthMap.set(anchorId, 0)
  const queue: Array<{ id: string; depth: number }> = [{ id: anchorId, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) {
      continue
    }

    for (const nextId of adjacency.get(current.id) ?? []) {
      if (!depthMap.has(nextId)) {
        depthMap.set(nextId, current.depth + 1)
        queue.push({ id: nextId, depth: current.depth + 1 })
      }
    }
  }

  return depthMap
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

function layoutGlobalNodes(nodes: KnowledgeGraphNode[]) {
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

function layoutLocalNodes(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[], anchorId: string) {
  const width = 1040
  const height = 620
  const centerX = width / 2
  const centerY = height / 2
  const visibleIds = new Set(nodes.map((node) => node.id))
  const adjacency = buildAdjacency(edges, visibleIds)
  const depthMap = buildDepthMap(anchorId, adjacency, 3)
  const groupedByDepth = new Map<number, Map<string, KnowledgeGraphNode[]>>()

  for (const node of nodes) {
    const depth = depthMap.get(node.id) ?? 3
    const byGroup = groupedByDepth.get(depth) ?? new Map<string, KnowledgeGraphNode[]>()
    const bucket = byGroup.get(node.group) ?? []
    bucket.push(node)
    byGroup.set(node.group, bucket)
    groupedByDepth.set(depth, byGroup)
  }

  const positioned: PositionedNode[] = []
  const anchorNode = nodes.find((node) => node.id === anchorId)
  if (anchorNode) {
    positioned.push({
      ...anchorNode,
      x: centerX,
      y: centerY,
      radius: 16 + Math.min(anchorNode.weight, 12) * 0.9,
      color: colorForGroup(anchorNode.group),
    })
  }

  for (const depth of [1, 2, 3]) {
    const groups = groupedByDepth.get(depth)
    if (!groups) {
      continue
    }

    const groupEntries = [...groups.entries()]
      .map(([group, groupNodes]) => [
        group,
        [...groupNodes].sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, "zh-CN")),
      ] as const)
      .sort((a, b) => a[0].localeCompare(b[0], "zh-CN"))

    const baseRadius = depth === 1 ? 150 : depth === 2 ? 270 : 370
    groupEntries.forEach(([group, groupNodes], groupIndex) => {
      const groupAngle = (Math.PI * 2 * groupIndex) / Math.max(groupEntries.length, 1) - Math.PI / 2
      const groupCenterX = centerX + Math.cos(groupAngle) * baseRadius
      const groupCenterY = centerY + Math.sin(groupAngle) * baseRadius * 0.68

      groupNodes.forEach((node, nodeIndex) => {
        const nodeAngle = (Math.PI * 2 * nodeIndex) / Math.max(groupNodes.length, 1) + groupAngle * 0.25
        const nodeRadius = nodeIndex === 0 ? 0 : 22 + Math.floor((nodeIndex - 1) / 6) * 22
        positioned.push({
          ...node,
          x: groupCenterX + Math.cos(nodeAngle) * nodeRadius,
          y: groupCenterY + Math.sin(nodeAngle) * nodeRadius,
          radius: (depth === 1 ? 12 : 9) + Math.min(node.weight, 10) * (depth === 1 ? 0.65 : 0.5),
          color: colorForGroup(group),
        })
      })
    })
  }

  return {
    width,
    height,
    nodes: positioned,
  }
}

function layoutNodes(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  scope: GraphScope,
  anchorId?: string,
) {
  if (scope === "local" && anchorId) {
    return layoutLocalNodes(nodes, edges, anchorId)
  }

  return layoutGlobalNodes(nodes)
}

function clampPosition(layoutWidth: number, layoutHeight: number, position: NodePosition) {
  return {
    x: Math.min(layoutWidth - 24, Math.max(24, position.x)),
    y: Math.min(layoutHeight - 24, Math.max(24, position.y)),
  }
}

function svgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * svg.viewBox.baseVal.width
  const y = ((clientY - rect.top) / rect.height) * svg.viewBox.baseVal.height
  return { x, y }
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
  const svgRef = useRef<SVGSVGElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const animatedPositionsRef = useRef<Record<string, NodePosition>>({})
  const allGroups = [...new Set(graph.nodes.map((node) => node.group))].sort((a, b) => a.localeCompare(b, "zh-CN"))
  const allRelationTypes = [...new Set(graph.edges.flatMap((edge) => edgeRelationTypes(edge)))].sort((a, b) =>
    a.localeCompare(b, "en"),
  )
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<GraphScope>("all")
  const [localDepth, setLocalDepth] = useState<LocalDepth>(1)
  const [collapseMode, setCollapseMode] = useState<CollapseMode>("none")
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(initialFocus)
  const [activeGroups, setActiveGroups] = useState<string[]>(allGroups)
  const [activeRelationTypes, setActiveRelationTypes] = useState<string[]>(allRelationTypes)
  const [pinnedNodeIds, setPinnedNodeIds] = useState<string[]>([])
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, NodePosition>>({})
  const [dragState, setDragState] = useState<DragState>(null)
  const [animatedPositions, setAnimatedPositions] = useState<Record<string, NodePosition>>({})
  const [evidenceCache, setEvidenceCache] = useState<Record<string, KnowledgeEvidenceResult>>({})
  const [evidenceLoadingKey, setEvidenceLoadingKey] = useState<string | undefined>()
  const [evidenceError, setEvidenceError] = useState<string | undefined>()
  const deferredQuery = useDeferredValue(query)

  const activeRelationTypeSet = new Set(activeRelationTypes)
  const relationScopedEdges =
    activeRelationTypes.length === 0
      ? []
      : graph.edges.filter((edge) =>
          edgeRelationTypes(edge).some((relationType) => activeRelationTypeSet.has(relationType)),
        )

  const baseVisibleIds =
    activeRelationTypes.length === 0
      ? new Set<string>()
      : buildVisibleNodeIds(
          graph.nodes,
          relationScopedEdges,
          deferredQuery,
          initialFocus,
          activeGroups,
          scope,
          localDepth,
          selectedNodeId,
        )

  const baseVisibleNodes = graph.nodes.filter((node) => baseVisibleIds.has(node.id))
  const baseVisibleNodeIdSet = new Set(baseVisibleNodes.map((node) => node.id))
  const baseVisibleEdges = relationScopedEdges.filter(
    (edge) => baseVisibleNodeIdSet.has(edge.source) && baseVisibleNodeIdSet.has(edge.target),
  )
  const baseDegreeMap = buildDegreeMap(baseVisibleEdges)
  const protectedNodeIds = new Set(
    [selectedNodeId, initialFocus, ...pinnedNodeIds].filter((nodeId): nodeId is string => Boolean(nodeId)),
  )
  const collapsedNodeIds = new Set(
    baseVisibleNodes
      .filter((node) => {
        if (collapseMode === "none" || protectedNodeIds.has(node.id)) {
          return false
        }

        const degree = baseDegreeMap.get(node.id) ?? 0
        if (collapseMode === "leaf") {
          return degree <= 1
        }

        return degree <= 2 && node.weight <= 3
      })
      .map((node) => node.id),
  )
  const visibleNodes = baseVisibleNodes.filter((node) => !collapsedNodeIds.has(node.id))
  const visibleNodeIdSet = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = baseVisibleEdges.filter(
    (edge) => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target),
  )
  const degreeMap = buildDegreeMap(visibleEdges)

  const selectedNode =
    visibleNodes.find((node) => node.id === selectedNodeId) ??
    visibleNodes.find((node) => node.id === initialFocus) ??
    visibleNodes[0]
  const selectedAnchorId = selectedNode?.id ?? initialFocus
  const baseLayout = layoutNodes(visibleNodes, visibleEdges, scope, selectedAnchorId)
  const layoutNodesWithOverrides = baseLayout.nodes.map((node) => {
    const override = nodeOverrides[node.id]
    return override
      ? {
          ...node,
          ...clampPosition(baseLayout.width, baseLayout.height, override),
        }
      : node
  })
  const targetPositions = Object.fromEntries(
    layoutNodesWithOverrides.map((node) => [node.id, { x: node.x, y: node.y }]),
  ) as Record<string, NodePosition>
  const renderedNodes = layoutNodesWithOverrides.map((node) => {
    const animated = animatedPositions[node.id]
    return animated
      ? {
          ...node,
          ...animated,
        }
      : node
  })
  const positionedMap = new Map(renderedNodes.map((node) => [node.id, node]))
  const allDocumentLabels = new Map(
    graph.nodes
      .filter((node) => node.group === "document" && typeof node.slug === "string")
      .map((node) => [node.slug as string, node.label]),
  )

  const selectedNodeHref = selectedNode ? graphNodeHref(sourceId, mode, selectedNode) : undefined
  const selectedPosition = selectedNode ? positionedMap.get(selectedNode.id) : undefined
  const selectedNodePinned = selectedNode ? pinnedNodeIds.includes(selectedNode.id) : false

  const selectedConnections: SelectedConnection[] = selectedNode
    ? visibleEdges
        .map((edge) => {
          if (edge.source !== selectedNode.id && edge.target !== selectedNode.id) {
            return undefined
          }

          const direction = edge.source === selectedNode.id ? "outgoing" : "incoming"
          const peerId = direction === "outgoing" ? edge.target : edge.source
          const peer = visibleNodes.find((node) => node.id === peerId)
          if (!peer) {
            return undefined
          }

          return {
            edge,
            peer,
            direction,
          }
        })
        .filter((item): item is SelectedConnection => Boolean(item))
        .sort(
          (a, b) =>
            edgeWeight(b.edge) - edgeWeight(a.edge) ||
            a.peer.label.localeCompare(b.peer.label, "zh-CN") ||
            a.direction.localeCompare(b.direction, "en"),
        )
    : []

  const selectedNodeRelationTypes = [
    ...new Set(selectedConnections.flatMap((connection) => edgeRelationTypes(connection.edge))),
  ]
  const selectedEvidenceDocuments = [
    ...new Set(selectedConnections.flatMap((connection) => edgeEvidenceSlugs(connection.edge))),
  ]
    .map((slug) => ({
      slug,
      title: allDocumentLabels.get(slug) ?? slug.split("/").at(-1) ?? slug,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))
  const selectedEvidenceKey = evidenceNodeKey(selectedNode)
  const selectedEvidenceResult = selectedEvidenceKey ? evidenceCache[selectedEvidenceKey] : undefined
  const selectedEvidencePreviewDocuments = selectedEvidenceResult?.documents.slice(0, 6) ?? []
  const relationSummary = buildCountSummary(selectedConnections.flatMap((connection) => edgeRelationTypes(connection.edge)))
  const groupSummary = buildCountSummary(selectedConnections.map((connection) => connection.peer.group))
  const selectedSummary = selectedEvidenceResult?.summary ?? {
    relationCount: selectedConnections.length,
    evidenceDocumentCount: selectedEvidenceDocuments.length,
    incomingCount: selectedConnections.filter((connection) => connection.direction === "incoming").length,
    outgoingCount: selectedConnections.filter((connection) => connection.direction === "outgoing").length,
  }

  const visibleRelationTypes = [...new Set(visibleEdges.flatMap((edge) => edgeRelationTypes(edge)))]

  useEffect(() => {
    animatedPositionsRef.current = animatedPositions
  }, [animatedPositions])

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const center = { x: baseLayout.width / 2, y: baseLayout.height / 2 }
    const anchorStart =
      (selectedAnchorId && animatedPositionsRef.current[selectedAnchorId]) ||
      (selectedAnchorId && targetPositions[selectedAnchorId]) ||
      center

    const startPositions = Object.fromEntries(
      layoutNodesWithOverrides.map((node) => [
        node.id,
        animatedPositionsRef.current[node.id] ?? anchorStart,
      ]),
    ) as Record<string, NodePosition>

    if (dragState) {
      animatedPositionsRef.current = targetPositions
      setAnimatedPositions(targetPositions)
      return
    }

    const duration = 560
    const startTime = performance.now()

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      const nextPositions = Object.fromEntries(
        layoutNodesWithOverrides.map((node) => {
          const from = startPositions[node.id] ?? center
          const to = targetPositions[node.id] ?? center
          return [
            node.id,
            {
              x: from.x + (to.x - from.x) * eased,
              y: from.y + (to.y - from.y) * eased,
            },
          ]
        }),
      ) as Record<string, NodePosition>

      animatedPositionsRef.current = nextPositions
      setAnimatedPositions(nextPositions)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step)
      } else {
        animationFrameRef.current = null
      }
    }

    animationFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [baseLayout.height, baseLayout.width, dragState, layoutNodesWithOverrides, selectedAnchorId, targetPositions])

  useEffect(() => {
    if (!selectedEvidenceKey) {
      setEvidenceLoadingKey(undefined)
      setEvidenceError(undefined)
      return
    }

    if (selectedEvidenceResult) {
      setEvidenceLoadingKey(undefined)
      setEvidenceError(undefined)
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams()
    if (selectedNode?.entityKey) {
      params.set("entityKey", selectedNode.entityKey)
    } else if (selectedNode?.slug) {
      params.set("slug", selectedNode.slug)
    } else {
      setEvidenceLoadingKey(undefined)
      setEvidenceError(undefined)
      return
    }

    params.set("limit", "8")
    setEvidenceLoadingKey(selectedEvidenceKey)
    setEvidenceError(undefined)

    fetch(`/api/source/${encodeURIComponent(sourceId)}/evidence?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => undefined)) as { message?: string } | undefined
          throw new Error(payload?.message ?? "Unable to load evidence preview")
        }

        return (await response.json()) as KnowledgeEvidenceResult
      })
      .then((result) => {
        setEvidenceCache((current) => ({
          ...current,
          [selectedEvidenceKey]: result,
        }))
        setEvidenceLoadingKey(undefined)
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return
        }

        setEvidenceLoadingKey(undefined)
        setEvidenceError(error instanceof Error ? error.message : "Unable to load evidence preview")
      })

    return () => controller.abort()
  }, [selectedEvidenceKey, selectedEvidenceResult, selectedNode?.entityKey, selectedNode?.slug, sourceId])

  const setNodePinned = (nodeId: string, pinned: boolean) => {
    setPinnedNodeIds((current) => {
      if (pinned) {
        return current.includes(nodeId) ? current : [...current, nodeId]
      }
      return current.filter((item) => item !== nodeId)
    })
  }

  const resetNodePosition = (nodeId: string) => {
    setNodeOverrides((current) => {
      const next = { ...current }
      delete next[nodeId]
      return next
    })
    setPinnedNodeIds((current) => current.filter((item) => item !== nodeId))
  }

  const resetLayout = () => {
    setNodeOverrides({})
    setPinnedNodeIds([])
    setDragState(null)
  }

  const handleNodePointerDown = (event: PointerEvent<SVGGElement>, node: PositionedNode) => {
    if (!svgRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setSelectedNodeId(node.id)
    setNodePinned(node.id, true)

    const point = svgPointFromClient(svgRef.current, event.clientX, event.clientY)
    setDragState({
      nodeId: node.id,
      pointerId: event.pointerId,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragState || !svgRef.current) {
      return
    }

    const point = svgPointFromClient(svgRef.current, event.clientX, event.clientY)
    setNodeOverrides((current) => ({
      ...current,
      [dragState.nodeId]: clampPosition(baseLayout.width, baseLayout.height, {
        x: point.x - dragState.offsetX,
        y: point.y - dragState.offsetY,
      }),
    }))
  }

  const handlePointerEnd = () => {
    setDragState(null)
  }

  return (
    <div className="graph-workspace">
      <div className="graph-stage">
        <div className="graph-toolbar">
          <div className="graph-search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索节点名称、分组或 entity key"
            />
          </div>
          <div className="badge-row">
            <span className="badge">{`可见节点 ${visibleNodes.length}`}</span>
            <span className="badge">{`可见边 ${visibleEdges.length}`}</span>
            <span className="badge">{`分组 ${new Set(visibleNodes.map((node) => node.group)).size}`}</span>
            <span className="badge">{`关系类型 ${visibleRelationTypes.length}`}</span>
            <span className="badge">{`固定节点 ${pinnedNodeIds.length}`}</span>
            <span className="badge">{`已折叠 ${collapsedNodeIds.size}`}</span>
          </div>
        </div>

        <div className="graph-controls">
          <div className="graph-control-group">
            <span className="graph-control-label">视图范围</span>
            <div className="graph-pill-row">
              <button
                type="button"
                className="graph-pill"
                data-active={scope === "all"}
                onClick={() => setScope("all")}
              >
                全图
              </button>
              <button
                type="button"
                className="graph-pill"
                data-active={scope === "local"}
                onClick={() => setScope("local")}
              >
                局部邻域
              </button>
            </div>
          </div>

          <div className="graph-control-group">
            <span className="graph-control-label">局部深度</span>
            <div className="graph-pill-row">
              <button
                type="button"
                className="graph-pill"
                data-active={localDepth === 1}
                onClick={() => setLocalDepth(1)}
              >
                1 跳
              </button>
              <button
                type="button"
                className="graph-pill"
                data-active={localDepth === 2}
                onClick={() => setLocalDepth(2)}
              >
                2 跳
              </button>
            </div>
          </div>

          <div className="graph-control-group graph-control-grow">
            <span className="graph-control-label">分组筛选</span>
            <div className="graph-pill-row">
              {allGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  className="graph-pill"
                  data-active={activeGroups.includes(group)}
                  onClick={() => setActiveGroups((current) => toggleSelection(current, group))}
                >
                  {groupLabel(group)}
                </button>
              ))}
              <button type="button" className="graph-pill" data-active="false" onClick={() => setActiveGroups(allGroups)}>
                重置
              </button>
            </div>
          </div>

          <div className="graph-control-group graph-control-grow">
            <span className="graph-control-label">关系类型</span>
            <div className="graph-pill-row">
              {allRelationTypes.map((relationType) => (
                <button
                  key={relationType}
                  type="button"
                  className="graph-pill"
                  data-active={activeRelationTypes.includes(relationType)}
                  onClick={() => setActiveRelationTypes((current) => toggleSelection(current, relationType))}
                >
                  {relationLabel(relationType)}
                </button>
              ))}
              <button
                type="button"
                className="graph-pill"
                data-active="false"
                onClick={() => setActiveRelationTypes(allRelationTypes)}
              >
                重置
              </button>
            </div>
          </div>

          <div className="graph-control-group">
            <span className="graph-control-label">折叠模式</span>
            <div className="graph-pill-row">
              <button
                type="button"
                className="graph-pill"
                data-active={collapseMode === "none"}
                onClick={() => setCollapseMode("none")}
              >
                不折叠
              </button>
              <button
                type="button"
                className="graph-pill"
                data-active={collapseMode === "leaf"}
                onClick={() => setCollapseMode("leaf")}
              >
                折叠叶子
              </button>
              <button
                type="button"
                className="graph-pill"
                data-active={collapseMode === "low-signal"}
                onClick={() => setCollapseMode("low-signal")}
              >
                折叠弱节点
              </button>
            </div>
          </div>

          <div className="graph-control-group">
            <span className="graph-control-label">布局工具</span>
            <div className="graph-pill-row">
              <button type="button" className="graph-pill" data-active="false" onClick={resetLayout}>
                重置布局
              </button>
              {selectedNode && (
                <button
                  type="button"
                  className="graph-pill"
                  data-active={selectedNodePinned}
                  onClick={() => {
                    if (selectedNodePinned) {
                      resetNodePosition(selectedNode.id)
                    } else if (selectedPosition) {
                      setNodeOverrides((current) => ({
                        ...current,
                        [selectedNode.id]: { x: selectedPosition.x, y: selectedPosition.y },
                      }))
                      setNodePinned(selectedNode.id, true)
                    }
                  }}
                >
                  {selectedNodePinned ? "取消固定" : "固定节点"}
                </button>
              )}
              {selectedNode && (
                <button
                  type="button"
                  className="graph-pill"
                  data-active={scope === "local" && localDepth === 2}
                  onClick={() => {
                    setScope("local")
                    setLocalDepth(2)
                    setSelectedNodeId(selectedNode.id)
                  }}
                >
                  展开当前节点
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="graph-canvas-shell">
          {visibleNodes.length === 0 ? (
            <div className="empty-state">没有命中节点，可以换个关键词或重置筛选。</div>
          ) : (
            <svg
              ref={svgRef}
              className="graph-canvas"
              viewBox={`0 0 ${baseLayout.width} ${baseLayout.height}`}
              role="img"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerLeave={handlePointerEnd}
            >
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
                    key={`${edge.source}-${edge.target}-${edgeRelationTypes(edge).join(",")}`}
                    className="graph-edge"
                    data-highlighted={highlighted}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                )
              })}
              {renderedNodes.map((node) => {
                const active = selectedNode?.id === node.id
                const pinned = pinnedNodeIds.includes(node.id)
                return (
                  <g
                    key={node.id}
                    className="graph-node"
                    data-active={active}
                    data-pinned={pinned}
                    onClick={() => setSelectedNodeId(node.id)}
                    onDoubleClick={() => {
                      if (pinned) {
                        resetNodePosition(node.id)
                      } else {
                        setNodeOverrides((current) => ({
                          ...current,
                          [node.id]: { x: node.x, y: node.y },
                        }))
                        setNodePinned(node.id, true)
                      }
                    }}
                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      fill={node.color}
                      style={{ animationDelay: `${(hashValue(node.id) % 11) * 0.18}s` }}
                    />
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
              <p>点击、拖拽或双击节点，可以聚焦、固定位置、查看证据并直接跳转到对应页面。</p>
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
                  <span className="badge">{`关系类型 ${selectedNodeRelationTypes.length}`}</span>
                  <span className="badge">{selectedNodePinned ? "已固定" : "未固定"}</span>
                </div>
                {selectedNodeRelationTypes.length > 0 && (
                  <div className="badge-row">
                    {selectedNodeRelationTypes.map((relationType) => (
                      <span key={relationType} className="badge">
                        {relationLabel(relationType)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="action-row">
                  <Link href={graphFocusHref(sourceId, mode, selectedNode)} className="ghost-link" prefetch={false}>
                    固定到当前节点
                  </Link>
                  {selectedNodeHref && (
                    <Link href={selectedNodeHref} className="ghost-link" prefetch={false}>
                      {mode === "knowledge" ? "打开知识分析" : "打开文档"}
                    </Link>
                  )}
                  <button type="button" className="graph-inline-button" onClick={() => setScope("local")}>
                    只看这个节点的邻域
                  </button>
                </div>
              </div>

              <div className="result-card">
                <h3>布局状态</h3>
                <p>
                  {selectedNodePinned
                    ? "当前节点已经固定，可以继续拖拽到合适位置。"
                    : "拖拽节点会自动固定位置，双击节点可以切换固定状态。"}
                </p>
                <div className="action-row">
                  <button
                    type="button"
                    className="graph-inline-button"
                    onClick={() => {
                      if (selectedNodePinned) {
                        resetNodePosition(selectedNode.id)
                      } else if (selectedPosition) {
                        setNodeOverrides((current) => ({
                          ...current,
                          [selectedNode.id]: { x: selectedPosition.x, y: selectedPosition.y },
                        }))
                        setNodePinned(selectedNode.id, true)
                      }
                    }}
                  >
                    {selectedNodePinned ? "取消固定" : "固定节点"}
                  </button>
                  <button type="button" className="graph-inline-button" onClick={() => resetNodePosition(selectedNode.id)}>
                    恢复自动布局
                  </button>
                </div>
              </div>

              <div className="result-card">
                <h3>节点标识</h3>
                <p>{selectedNode.entityKey ?? selectedNode.slug ?? selectedNode.id}</p>
              </div>

              <div className="result-card">
                <h3>关系摘要</h3>
                <div className="graph-summary-grid">
                  <div className="graph-summary-stat">
                    <strong>{selectedConnections.length}</strong>
                    <span>可见连接</span>
                  </div>
                  <div className="graph-summary-stat">
                    <strong>{selectedSummary.relationCount}</strong>
                    <span>关系条目</span>
                  </div>
                  <div className="graph-summary-stat">
                    <strong>{selectedSummary.incomingCount}</strong>
                    <span>向内关系</span>
                  </div>
                  <div className="graph-summary-stat">
                    <strong>{selectedSummary.outgoingCount}</strong>
                    <span>向外关系</span>
                  </div>
                </div>
                <div className="graph-summary-columns">
                  <div className="graph-summary-panel">
                    <h4>关系类型</h4>
                    <div className="graph-summary-list">
                      {relationSummary.slice(0, 6).map((item) => (
                        <div key={item.key} className="graph-summary-row">
                          <span>{relationLabel(item.key)}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                      {relationSummary.length === 0 && <div className="empty-state">当前节点还没有可见关系。</div>}
                    </div>
                  </div>
                  <div className="graph-summary-panel">
                    <h4>相邻分组</h4>
                    <div className="graph-summary-list">
                      {groupSummary.slice(0, 6).map((item) => (
                        <div key={item.key} className="graph-summary-row">
                          <span>{groupLabel(item.key)}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                      {groupSummary.length === 0 && <div className="empty-state">当前节点还没有相邻节点。</div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="result-card">
                <h3>连接关系</h3>
                <div className="result-list">
                  {selectedConnections.map((connection) => {
                    const peerHref = graphNodeHref(sourceId, mode, connection.peer)
                    const primaryEvidence = edgeEvidenceSlugs(connection.edge)[0]
                    return (
                      <div
                        key={`${selectedNode.id}-${connection.peer.id}-${edgeRelationTypes(connection.edge).join(",")}`}
                        className="graph-connection-card"
                      >
                        <div className="graph-connection-header">
                          <div>
                            <strong>{connection.peer.label}</strong>
                            <small>{`${connection.direction === "outgoing" ? "向外连接" : "向内连接"} · ${groupLabel(connection.peer.group)}`}</small>
                          </div>
                          <span className="badge">{`边权重 ${edgeWeight(connection.edge)}`}</span>
                        </div>
                        <div className="badge-row">
                          {edgeRelationTypes(connection.edge).map((relationType) => (
                            <span key={`${connection.peer.id}-${relationType}`} className="badge">
                              {relationLabel(relationType)}
                            </span>
                          ))}
                        </div>
                        <div className="action-row">
                          <button
                            type="button"
                            className="graph-inline-button"
                            onClick={() => setSelectedNodeId(connection.peer.id)}
                          >
                            聚焦节点
                          </button>
                          {peerHref && (
                            <Link href={peerHref} className="ghost-link" prefetch={false}>
                              {mode === "knowledge" ? "打开知识分析" : "打开文档"}
                            </Link>
                          )}
                          {primaryEvidence && (
                            <Link href={documentHref(sourceId, primaryEvidence)} className="ghost-link" prefetch={false}>
                              打开证据
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {selectedConnections.length === 0 && (
                    <div className="empty-state">当前节点在可见范围内没有连接关系。</div>
                  )}
                </div>
              </div>

              <div className="result-card">
                <h3>证据预览</h3>
                <div className="badge-row">
                  <span className="badge">{`证据文档 ${selectedSummary.evidenceDocumentCount}`}</span>
                  <span className="badge">{`快速跳转 ${selectedEvidenceDocuments.length}`}</span>
                  {evidenceLoadingKey === selectedEvidenceKey && <span className="badge">加载中</span>}
                </div>
                <div className="result-list">
                  {selectedEvidencePreviewDocuments.map((document) => (
                    <div key={document.slug} className="graph-evidence-preview">
                      <div className="graph-evidence-preview-header">
                        <div>
                          <strong>{document.title}</strong>
                          <small>{document.slug}</small>
                        </div>
                        <span className="badge">{`关系 ${document.relationKeys.length}`}</span>
                      </div>
                      <p>{document.summary || "当前证据文档还没有可展示的摘要。"}</p>
                      <div className="graph-evidence-meta">
                        <span>{`更新于 ${formatGraphDate(document.updatedAt)}`}</span>
                        <Link href={documentHref(sourceId, document.slug)} className="ghost-link" prefetch={false}>
                          打开文档
                        </Link>
                      </div>
                    </div>
                  ))}
                  {evidenceLoadingKey === selectedEvidenceKey && selectedEvidencePreviewDocuments.length === 0 && (
                    <div className="empty-state">正在加载证据预览。</div>
                  )}
                  {evidenceError && selectedEvidenceKey && evidenceLoadingKey !== selectedEvidenceKey && (
                    <div className="empty-state">{evidenceError}</div>
                  )}
                  {selectedEvidencePreviewDocuments.length === 0 &&
                    selectedEvidenceDocuments.length > 0 &&
                    evidenceLoadingKey !== selectedEvidenceKey &&
                    !evidenceError &&
                    selectedEvidenceDocuments.slice(0, 6).map((document) => (
                      <Link
                        key={document.slug}
                        href={documentHref(sourceId, document.slug)}
                        className="graph-evidence-link"
                        prefetch={false}
                      >
                        <strong>{document.title}</strong>
                        <small>{document.slug}</small>
                      </Link>
                    ))}
                  {selectedEvidencePreviewDocuments.length === 0 &&
                    selectedEvidenceDocuments.length === 0 &&
                    evidenceLoadingKey !== selectedEvidenceKey &&
                    !evidenceError && <div className="empty-state">当前节点还没有可展示的证据文档。</div>}
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
