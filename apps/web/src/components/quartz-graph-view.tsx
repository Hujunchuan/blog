"use client"

import Link from "next/link"
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react"
import {
  Application,
  Color,
  Container,
  FederatedPointerEvent,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js"
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from "d3-force"
import { KnowledgeGraphEdge, KnowledgeGraphMode, KnowledgeGraphNode } from "@repo/core/types"

const palette = ["#6b7c88", "#b7793f", "#62824b", "#8b6075", "#4d7190", "#7d6948"]
const groupColorMap: Partial<Record<string, string>> = {
  root: "#2f5d73",
  document: "#6b7c88",
  tag: "#8a6f4d",
  concept: "#567663",
  person: "#8b6075",
  project: "#4d7190",
  meeting: "#907253",
  decision: "#706894",
  task: "#6d8751",
  practice: "#4b7d78",
}
const LOCAL_CANVAS_WIDTH = 960
const LOCAL_CANVAS_HEIGHT = 560
const GLOBAL_CANVAS_WIDTH = 1400
const GLOBAL_CANVAS_HEIGHT = 820

type Depth = 1 | 2
type GraphVariant = "local" | "global"

type GraphNodeData = KnowledgeGraphNode &
  SimulationNodeDatum & {
    radius: number
    color: string
  }

type GraphLinkData = SimulationLinkDatum<GraphNodeData> & {
  source: GraphNodeData
  target: GraphNodeData
  weight: number
}

type RenderGraph = {
  nodes: GraphNodeData[]
  edges: GraphLinkData[]
  adjacency: Map<string, Set<string>>
  degreeMap: Map<string, number>
}

type ViewTransform = {
  x: number
  y: number
  scale: number
}

type NodeRenderDatum = {
  node: GraphNodeData
  gfx: Graphics
  label: Text
}

type EdgeRenderDatum = {
  edge: GraphLinkData
  gfx: Graphics
}

const _legacyGroupLabels: Record<string, string> = {
  root: "根节点",
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

const groupLabels: Record<string, string> = {
  root: "根节点",
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
  return groupColorMap[group] ?? palette[hashValue(group) % palette.length]
}

function edgeWeight(edge: KnowledgeGraphEdge | GraphLinkData) {
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

function buildKnowledgeAnalysisUrl(
  sourceId: string,
  input: {
    slug?: string
    entityKey?: string
  },
) {
  const params = new URLSearchParams()
  if (input.slug) {
    params.set("slug", input.slug)
  }
  if (input.entityKey) {
    params.set("entityKey", input.entityKey)
  }

  const query = params.toString()
  return `/source/${encodeURIComponent(sourceId)}/knowledge${query ? `?${query}` : ""}`
}

function analysisSectionHref(
  sourceId: string,
  mode: KnowledgeGraphMode,
  node: KnowledgeGraphNode,
  section: "related" | "impact" | "evidence",
) {
  const base =
    mode === "knowledge"
      ? node.entityKey
        ? buildKnowledgeAnalysisUrl(sourceId, { entityKey: node.entityKey })
        : node.slug
          ? buildKnowledgeAnalysisUrl(sourceId, { slug: node.slug })
          : undefined
      : node.slug
        ? buildKnowledgeAnalysisUrl(sourceId, { slug: node.slug })
        : undefined

  return base ? `${base}#${section}` : undefined
}

function clampScale(scale: number) {
  return Math.min(2.8, Math.max(0.65, scale))
}

function buildAdjacency(edges: Array<{ source: string; target: string }>, allowedIds: Set<string>) {
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

function buildDegreeMap(edges: Array<{ source: string; target: string }>) {
  const degrees = new Map<string, number>()

  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
  }

  return degrees
}

function buildRenderGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  focusNodeId: string,
  depth: Depth,
  variant: GraphVariant,
) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const adjacency = buildAdjacency(edges, nodeIds)
  const depthMap = buildDepthMap(focusNodeId, adjacency, depth)
  const neighborhoodNodes = nodes.filter((node) => depthMap.has(node.id))
  const neighborhoodNodeIds = new Set(neighborhoodNodes.map((node) => node.id))
  const neighborhoodEdges = edges.filter(
    (edge) => neighborhoodNodeIds.has(edge.source) && neighborhoodNodeIds.has(edge.target),
  )
  const degreeMap = buildDegreeMap(neighborhoodEdges)

  const rankedNodes = [...neighborhoodNodes].sort((left, right) => {
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

  const maxNodeCount = variant === "global" ? (depth === 1 ? 64 : 120) : depth === 1 ? 28 : 56
  const keptIds = new Set(rankedNodes.slice(0, maxNodeCount).map((node) => node.id))
  keptIds.add(focusNodeId)

  const keptNodes: GraphNodeData[] = neighborhoodNodes
    .filter((node) => keptIds.has(node.id))
    .map((node) => ({
      ...node,
      radius: (node.id === focusNodeId ? 12 : 7.5) + Math.min(node.weight, 10) * (node.id === focusNodeId ? 0.35 : 0.18),
      color: colorForGroup(node.group),
      x: node.id === focusNodeId ? 0 : undefined,
      y: node.id === focusNodeId ? 0 : undefined,
    }))

  const keptNodeIds = new Set(keptNodes.map((node) => node.id))
  const keptEdges = neighborhoodEdges
    .filter((edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target))
    .sort((left, right) => {
      const leftFocus = left.source === focusNodeId || left.target === focusNodeId ? 1 : 0
      const rightFocus = right.source === focusNodeId || right.target === focusNodeId ? 1 : 0
      if (leftFocus !== rightFocus) {
        return rightFocus - leftFocus
      }
      return edgeWeight(right) - edgeWeight(left)
    })
    .slice(0, variant === "global" ? (depth === 1 ? 180 : 320) : depth === 1 ? 72 : 132)

  const nodeMap = new Map(keptNodes.map((node) => [node.id, node]))
  const simulationEdges: GraphLinkData[] = keptEdges.flatMap((edge) => {
    const source = nodeMap.get(edge.source)
    const target = nodeMap.get(edge.target)
    if (!source || !target) {
      return []
    }

    return [
      {
        source,
        target,
        weight: edgeWeight(edge),
      },
    ]
  })

  return {
    nodes: keptNodes,
    edges: simulationEdges,
    adjacency: buildAdjacency(
      simulationEdges.map((edge) => ({ source: edge.source.id, target: edge.target.id })),
      new Set(keptNodes.map((node) => node.id)),
    ),
    degreeMap: buildDegreeMap(
      simulationEdges.map((edge) => ({ source: edge.source.id, target: edge.target.id })),
    ),
  } satisfies RenderGraph
}

function drawNode(gfx: Graphics, radius: number, fillColor: string, highlighted: boolean, anchored: boolean) {
  gfx.clear()
  if (anchored) {
    gfx.circle(0, 0, radius + 4.5)
    gfx.fill({ color: new Color(fillColor), alpha: 0.08 })
    gfx.stroke({
      width: highlighted ? 1.8 : 1.2,
      color: new Color(fillColor),
      alpha: highlighted ? 0.56 : 0.28,
    })
  }
  gfx.circle(0, 0, radius)
  gfx.fill(new Color(fillColor))
  gfx.stroke({
    width: highlighted ? 3 : 2,
    color: new Color(highlighted ? "#f6efe2" : "#ffffff"),
    alpha: highlighted ? 1 : 0.92,
  })
}

export function QuartzGraphView({
  sourceId,
  mode,
  graph,
  initialFocus,
  variant = "local",
  onFocusChange,
  onOpenGlobal,
  onCloseGlobal,
}: {
  sourceId: string
  mode: KnowledgeGraphMode
  graph: {
    nodes: KnowledgeGraphNode[]
    edges: KnowledgeGraphEdge[]
  }
  initialFocus?: string
  variant?: GraphVariant
  onFocusChange?: (nodeId: string | undefined) => void
  onOpenGlobal?: () => void
  onCloseGlobal?: () => void
}) {
  const canvasWidth = variant === "global" ? GLOBAL_CANVAS_WIDTH : LOCAL_CANVAS_WIDTH
  const canvasHeight = variant === "global" ? GLOBAL_CANVAS_HEIGHT : LOCAL_CANVAS_HEIGHT
  const containerRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const backgroundRef = useRef<Graphics | null>(null)
  const linksLayerRef = useRef<Container | null>(null)
  const nodesLayerRef = useRef<Container | null>(null)
  const labelsLayerRef = useRef<Container | null>(null)
  const simulationRef = useRef<Simulation<GraphNodeData, GraphLinkData> | null>(null)
  const renderFrameRef = useRef<number | null>(null)
  const nodeRenderRef = useRef<Map<string, NodeRenderDatum>>(new Map())
  const edgeRenderRef = useRef<EdgeRenderDatum[]>([])
  const adjacencyRef = useRef<Map<string, Set<string>>>(new Map())
  const hoveredNodeIdRef = useRef<string | undefined>(undefined)
  const selectedNodeIdRef = useRef<string | undefined>(undefined)
  const dragNodeIdRef = useRef<string | undefined>(undefined)
  const lastTapRef = useRef<{ nodeId: string; at: number } | null>(null)
  const viewRef = useRef<ViewTransform>({ x: canvasWidth / 2, y: canvasHeight / 2, scale: 1 })
  const panRef = useRef<{
    active: boolean
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const applyHighlightRef = useRef<() => void>(() => {})
  const [depth, setDepth] = useState<Depth>(variant === "global" ? 2 : 1)
  const [searchValue, setSearchValue] = useState("")
  const [rendererReadyTick, setRendererReadyTick] = useState(0)
  const graphPickerId = useId()
  const defaultFocusNodeId = useMemo(() => {
    if (initialFocus && graph.nodes.some((node) => node.id === initialFocus)) {
      return initialFocus
    }

    return [...graph.nodes]
      .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label, "zh-CN"))[0]?.id
  }, [graph.nodes, initialFocus])
  const [focusNodeId, setFocusNodeId] = useState<string | undefined>(defaultFocusNodeId)
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(defaultFocusNodeId)
  const rootNode = useMemo(
    () => graph.nodes.find((node) => node.id === defaultFocusNodeId),
    [defaultFocusNodeId, graph.nodes],
  )
  const graphOptions = useMemo(
    () =>
      [...graph.nodes]
        .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label, "zh-CN"))
        .slice(0, 240),
    [graph.nodes],
  )

  const scheduleRender = () => {
    if (renderFrameRef.current !== null) {
      return
    }

    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null
      appRef.current?.render()
    })
  }

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
    applyHighlightRef.current()
  }, [selectedNodeId])

  useEffect(() => {
    setDepth(variant === "global" ? 2 : 1)
  }, [variant])

  useEffect(() => {
    if (!initialFocus || !graph.nodes.some((node) => node.id === initialFocus)) {
      return
    }

    setFocusNodeId((current) => (current === initialFocus ? current : initialFocus))
    setSelectedNodeId((current) => (current === initialFocus ? current : initialFocus))
  }, [graph.nodes, initialFocus])

  useEffect(() => {
    onFocusChange?.(focusNodeId)
  }, [focusNodeId, onFocusChange])

  useEffect(() => {
    if (!focusNodeId && defaultFocusNodeId) {
      setFocusNodeId(defaultFocusNodeId)
    }
    if (!selectedNodeId && defaultFocusNodeId) {
      setSelectedNodeId(defaultFocusNodeId)
    }
  }, [defaultFocusNodeId, focusNodeId, selectedNodeId])

  const renderGraph = useMemo(() => {
    if (!focusNodeId) {
      return undefined
    }
    return buildRenderGraph(graph.nodes, graph.edges, focusNodeId, depth, variant)
  }, [depth, focusNodeId, graph.edges, graph.nodes, variant])

  const selectedNode =
    renderGraph?.nodes.find((node) => node.id === selectedNodeId) ??
    renderGraph?.nodes.find((node) => node.id === focusNodeId) ??
    renderGraph?.nodes[0]

  const selectedConnections = useMemo(() => {
    if (!selectedNode || !renderGraph) {
      return []
    }

    return renderGraph.edges
      .filter((edge) => edge.source.id === selectedNode.id || edge.target.id === selectedNode.id)
      .map((edge) => ({
        edge,
        peer: edge.source.id === selectedNode.id ? edge.target : edge.source,
      }))
      .sort((left, right) => edgeWeight(right.edge) - edgeWeight(left.edge))
      .slice(0, 8)
  }, [renderGraph, selectedNode])

  const focusNode = (nodeId: string | undefined) => {
    if (!nodeId) {
      return
    }

    setFocusNodeId(nodeId)
    setSelectedNodeId(nodeId)
  }

  const resolveNodeFromQuery = (query: string) => {
    const normalized = query.trim()
    if (!normalized) {
      return undefined
    }

    return graph.nodes.find((node) => {
      return (
        node.id === normalized ||
        node.label === normalized ||
        node.slug === normalized ||
        node.entityKey === normalized
      )
    })
  }

  const handleFocusSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const match = resolveNodeFromQuery(searchValue)
    if (!match) {
      return
    }

    focusNode(match.id)
    setSearchValue(match.label)
  }

  useEffect(() => {
    if (!containerRef.current || appRef.current) {
      return
    }

    let cancelled = false
    const container = containerRef.current
    const init = async () => {
      const app = new Application()
      await app.init({
        width: canvasWidth,
        height: canvasHeight,
        antialias: true,
        autoDensity: true,
        autoStart: false,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio,
      })

      if (cancelled) {
        app.destroy()
        return
      }

      container.style.width = "100%"
      container.style.minHeight = "0"
      container.style.height = "auto"
      container.style.aspectRatio = `${canvasWidth} / ${canvasHeight}`
      app.canvas.style.width = "100%"
      app.canvas.style.height = "100%"
      app.canvas.style.display = "block"
      container.appendChild(app.canvas)

      const world = new Container()
      const background = new Graphics()
      background.rect(0, 0, canvasWidth, canvasHeight)
      background.fill({ color: 0xffffff, alpha: 0.001 })
      background.eventMode = "static"

      const linksLayer = new Container()
      const nodesLayer = new Container()
      const labelsLayer = new Container()
      labelsLayer.eventMode = "none"

      world.addChild(linksLayer, nodesLayer, labelsLayer)
      app.stage.addChild(background, world)

      appRef.current = app
      worldRef.current = world
      backgroundRef.current = background
      linksLayerRef.current = linksLayer
      nodesLayerRef.current = nodesLayer
      labelsLayerRef.current = labelsLayer
      setRendererReadyTick((current) => current + 1)

      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        event.stopPropagation()

        const rect = app.canvas.getBoundingClientRect()
        const pointX = ((event.clientX - rect.left) / rect.width) * canvasWidth
        const pointY = ((event.clientY - rect.top) / rect.height) * canvasHeight
        const current = viewRef.current
        const nextScale = clampScale(current.scale * (event.deltaY < 0 ? 1.08 : 0.92))
        const worldX = (pointX - current.x) / current.scale
        const worldY = (pointY - current.y) / current.scale

        viewRef.current = {
          scale: nextScale,
          x: pointX - worldX * nextScale,
          y: pointY - worldY * nextScale,
        }

        world.position.set(viewRef.current.x, viewRef.current.y)
        world.scale.set(viewRef.current.scale)
        applyHighlightRef.current?.()
        scheduleRender()
      }

      app.canvas.addEventListener("wheel", handleWheel, { passive: false })

      background.on("pointerdown", (event: FederatedPointerEvent) => {
        if (dragNodeIdRef.current) {
          return
        }

        panRef.current = {
          active: true,
          pointerId: event.pointerId,
          startX: event.global.x,
          startY: event.global.y,
          originX: viewRef.current.x,
          originY: viewRef.current.y,
        }
      })

      background.on("pointermove", (event: FederatedPointerEvent) => {
        if (!panRef.current || !panRef.current.active || panRef.current.pointerId !== event.pointerId) {
          return
        }

        viewRef.current = {
          ...viewRef.current,
          x: panRef.current.originX + (event.global.x - panRef.current.startX),
          y: panRef.current.originY + (event.global.y - panRef.current.startY),
        }

        world.position.set(viewRef.current.x, viewRef.current.y)
        scheduleRender()
      })

      const endPan = (event?: FederatedPointerEvent) => {
        if (!panRef.current) {
          return
        }
        if (event && panRef.current.pointerId !== event.pointerId) {
          return
        }
        panRef.current = null
      }

      background.on("pointerup", endPan)
      background.on("pointerupoutside", endPan)
      background.on("pointerleave", endPan)

      return () => {
        app.canvas.removeEventListener("wheel", handleWheel)
      }
    }

    let detach: (() => void) | undefined
    void init().then((cleanup) => {
      detach = cleanup
    })

    return () => {
      cancelled = true
      detach?.()
      if (renderFrameRef.current !== null) {
        cancelAnimationFrame(renderFrameRef.current)
      }
      simulationRef.current?.stop()
      nodeRenderRef.current.clear()
      edgeRenderRef.current = []
      if (appRef.current) {
        appRef.current.destroy()
      }
      appRef.current = null
      worldRef.current = null
      backgroundRef.current = null
      linksLayerRef.current = null
      nodesLayerRef.current = null
      labelsLayerRef.current = null
    }
  }, [canvasHeight, canvasWidth])

  useEffect(() => {
    const app = appRef.current
    const world = worldRef.current
    const linksLayer = linksLayerRef.current
    const nodesLayer = nodesLayerRef.current
    const labelsLayer = labelsLayerRef.current
    if (!app || !world || !linksLayer || !nodesLayer || !labelsLayer || !renderGraph || !focusNodeId) {
      return
    }

    simulationRef.current?.stop()
    nodeRenderRef.current.clear()
    edgeRenderRef.current = []
    adjacencyRef.current = renderGraph.adjacency
    hoveredNodeIdRef.current = undefined
    dragNodeIdRef.current = undefined

    linksLayer.removeChildren()
    nodesLayer.removeChildren()
    labelsLayer.removeChildren()

    viewRef.current = { x: canvasWidth / 2, y: canvasHeight / 2, scale: 1 }
    world.position.set(viewRef.current.x, viewRef.current.y)
    world.scale.set(1)

    const renderScene = () => {
      for (const { edge, gfx } of edgeRenderRef.current) {
        gfx.clear()
        gfx.moveTo(edge.source.x ?? 0, edge.source.y ?? 0)
        gfx.lineTo(edge.target.x ?? 0, edge.target.y ?? 0)
        const touchesActive = Boolean(
          selectedNodeIdRef.current &&
            (edge.source.id === selectedNodeIdRef.current || edge.target.id === selectedNodeIdRef.current),
        )
        const touchesFocus = edge.source.id === focusNodeId || edge.target.id === focusNodeId
        gfx.stroke({
          width: touchesActive
            ? 1.9 + Math.min(edge.weight, 4) * 0.16
            : touchesFocus
              ? 1.35 + Math.min(edge.weight, 4) * 0.12
              : 0.92,
          color: new Color(touchesActive ? "#486d8d" : touchesFocus ? "#71858f" : "#9da7ab"),
          alpha: gfx.alpha || 0.22,
        })
      }

      nodeRenderRef.current.forEach(({ node, gfx, label }) => {
        if (typeof node.x === "number" && typeof node.y === "number") {
          gfx.position.set(node.x, node.y)
          label.position.set(node.x, node.y + node.radius + 12)
        }
      })

      applyLabelCulling()
      scheduleRender()
    }

    const labelStyle = new TextStyle({
      fontFamily: "IBM Plex Sans, Noto Sans SC, sans-serif",
      fontSize: 12,
      fill: "#2f3d46",
      fontWeight: "500",
    })

    const labelAlphaForNode = ({
      isActive,
      isNeighbor,
      isAnchor,
      isProminent,
    }: {
      isActive: boolean
      isNeighbor: boolean
      isAnchor: boolean
      isProminent: boolean
    }) => {
      const zoom = viewRef.current.scale
      if (isActive) {
        return 1
      }

      if (isNeighbor) {
        return zoom >= 1.1 ? 0.92 : 0.82
      }

      if (isAnchor) {
        return zoom >= 1 ? 0.88 : 0.72
      }

      if (variant === "global") {
        if (zoom >= 1.55) {
          return isProminent ? 0.72 : 0.18
        }
        if (zoom >= 1.2) {
          return isProminent ? 0.46 : 0.08
        }
        return isProminent ? 0.2 : 0
      }

      if (zoom >= 1.45) {
        return isProminent ? 0.82 : 0.22
      }
      if (zoom >= 1.1) {
        return isProminent ? 0.58 : 0.12
      }
      return isProminent ? 0.34 : 0.04
    }

    const applyLabelCulling = () => {
      const activeNodeId = hoveredNodeIdRef.current ?? selectedNodeIdRef.current ?? focusNodeId
      const neighbors = activeNodeId ? adjacencyRef.current.get(activeNodeId) ?? new Set<string>() : new Set<string>()
      const zoom = viewRef.current.scale
      const placed: Array<{ left: number; right: number; top: number; bottom: number }> = []

      const candidates = Array.from(nodeRenderRef.current.values())
        .map(({ node, label }) => {
          const isActive = node.id === activeNodeId
          const isNeighbor = neighbors.has(node.id)
          const isAnchor = node.id === focusNodeId
          const isProminent = isAnchor || node.group === "root" || node.weight >= (variant === "global" ? 9 : 6)

          return {
            node,
            label,
            baseAlpha: labelAlphaForNode({ isActive, isNeighbor, isAnchor, isProminent }),
            priority: isActive ? 5 : isAnchor ? 4 : isNeighbor ? 3 : isProminent ? 2 : 1,
          }
        })
        .sort((left, right) => {
          if (left.priority !== right.priority) {
            return right.priority - left.priority
          }
          if (left.baseAlpha !== right.baseAlpha) {
            return right.baseAlpha - left.baseAlpha
          }
          return right.node.weight - left.node.weight
        })

      for (const { label, baseAlpha } of candidates) {
        if (baseAlpha <= 0.02) {
          label.alpha = 0
          continue
        }

        const width = Math.max(42, label.width * zoom + 10)
        const height = Math.max(16, label.height * zoom + 6)
        const screenX = label.position.x * zoom + viewRef.current.x
        const screenY = label.position.y * zoom + viewRef.current.y
        const rect = {
          left: screenX - width / 2,
          right: screenX + width / 2,
          top: screenY - height,
          bottom: screenY,
        }

        const overlaps = placed.some(
          (existing) =>
            rect.left < existing.right &&
            rect.right > existing.left &&
            rect.top < existing.bottom &&
            rect.bottom > existing.top,
        )

        if (overlaps) {
          label.alpha = 0
          continue
        }

        label.alpha = baseAlpha
        placed.push(rect)
      }
    }

    const applyHighlight = () => {
      const hoveredNodeId = hoveredNodeIdRef.current
      const activeNodeId = hoveredNodeId ?? selectedNodeIdRef.current ?? focusNodeId
      const hoverSpotlight = Boolean(hoveredNodeId)
      const neighbors = activeNodeId ? adjacencyRef.current.get(activeNodeId) ?? new Set<string>() : new Set<string>()

      nodeRenderRef.current.forEach(({ node, gfx, label }) => {
        const isActive = node.id === activeNodeId
        const isNeighbor = neighbors.has(node.id)
        const isAnchor = node.id === focusNodeId
        const isProminent = isAnchor || node.group === "root" || node.weight >= (variant === "global" ? 9 : 6)
        const dimmed = Boolean(activeNodeId) && !isActive && !isNeighbor
        gfx.alpha = hoverSpotlight ? (dimmed ? 0.1 : isNeighbor ? 0.9 : 1) : dimmed ? 0.22 : isNeighbor ? 0.94 : 1
        gfx.scale.set(isActive ? 1.12 : isNeighbor ? 1.05 : isAnchor ? 1.03 : 1)
        drawNode(gfx, node.radius, node.color, isActive || isAnchor, isAnchor)
        label.alpha = hoverSpotlight && !isActive && !isNeighbor
          ? 0
          : labelAlphaForNode({ isActive, isNeighbor, isAnchor, isProminent })
      })

      for (const { edge, gfx } of edgeRenderRef.current) {
        const touchesActive = Boolean(
          activeNodeId && (edge.source.id === activeNodeId || edge.target.id === activeNodeId),
        )
        const touchesFocus = edge.source.id === focusNodeId || edge.target.id === focusNodeId
        const adjacentBand = Boolean(
          activeNodeId && neighbors.has(edge.source.id) && neighbors.has(edge.target.id),
        )
        gfx.alpha = hoverSpotlight
          ? touchesActive
            ? 0.96
            : adjacentBand
              ? 0.16
              : 0.03
          : touchesActive
            ? 0.94
            : touchesFocus
              ? 0.42
              : adjacentBand
                ? 0.28
                : 0.12
      }

      renderScene()
    }

    applyHighlightRef.current = applyHighlight

    for (const node of renderGraph.nodes) {
      const gfx = new Graphics()
      drawNode(gfx, node.radius, node.color, node.id === selectedNodeIdRef.current, node.id === focusNodeId)
      gfx.eventMode = "static"
      gfx.cursor = "pointer"

      const label = new Text({
        text: node.label.length > 16 ? `${node.label.slice(0, 16)}...` : node.label,
        style: labelStyle,
        anchor: { x: 0.5, y: 1.1 },
        alpha: 0.16,
      })

      gfx.on("pointerover", () => {
        hoveredNodeIdRef.current = node.id
        applyHighlight()
      })
      gfx.on("pointerout", () => {
        hoveredNodeIdRef.current = undefined
        applyHighlight()
      })
      gfx.on("pointertap", () => {
        const now = Date.now()
        const previous = lastTapRef.current
        setSelectedNodeId(node.id)
        if (previous && previous.nodeId === node.id && now - previous.at < 260) {
          setFocusNodeId(node.id)
        }
        lastTapRef.current = { nodeId: node.id, at: now }
      })
      gfx.on("pointerdown", (event: FederatedPointerEvent) => {
        dragNodeIdRef.current = node.id
        node.fx = (event.global.x - world.position.x) / world.scale.x
        node.fy = (event.global.y - world.position.y) / world.scale.y
        simulationRef.current?.alphaTarget(0.9).restart()
        renderScene()
      })
      gfx.on("pointermove", (event: FederatedPointerEvent) => {
        if (dragNodeIdRef.current !== node.id) {
          return
        }
        node.fx = (event.global.x - world.position.x) / world.scale.x
        node.fy = (event.global.y - world.position.y) / world.scale.y
        renderScene()
      })

      const endDrag = () => {
        if (dragNodeIdRef.current !== node.id) {
          return
        }
        dragNodeIdRef.current = undefined
        node.fx = null
        node.fy = null
        simulationRef.current?.alphaTarget(0)
        renderScene()
      }

      gfx.on("pointerup", endDrag)
      gfx.on("pointerupoutside", endDrag)

      nodesLayer.addChild(gfx)
      labelsLayer.addChild(label)
      nodeRenderRef.current.set(node.id, { node, gfx, label })
    }

    for (const edge of renderGraph.edges) {
      const gfx = new Graphics()
      linksLayer.addChild(gfx)
      edgeRenderRef.current.push({ edge, gfx })
    }

    const simulation = forceSimulation<GraphNodeData, GraphLinkData>(renderGraph.nodes)
      .alpha(0.86)
      .alphaMin(0.03)
      .alphaDecay(0.05)
      .velocityDecay(0.34)
      .force("charge", forceManyBody<GraphNodeData>().strength((node) => (node.id === focusNodeId ? -340 : -170)))
      .force("center", forceCenter(0, 0).strength(0.12))
      .force(
        "link",
        forceLink<GraphNodeData, GraphLinkData>(renderGraph.edges)
          .id((node) => node.id)
          .distance((link) => (link.source.id === focusNodeId || link.target.id === focusNodeId ? 88 : 64))
          .strength((link) => (link.source.id === focusNodeId || link.target.id === focusNodeId ? 0.74 : 0.46)),
      )
      .force("collide", forceCollide<GraphNodeData>().radius((node) => node.radius + 12).iterations(2))

    simulationRef.current = simulation
    simulation.on("tick", renderScene)
    simulation.on("end", renderScene)
    applyHighlight()

    const cooldown = window.setTimeout(() => {
      simulation.alphaTarget(0)
      simulation.stop()
    }, 1400)

    return () => {
      window.clearTimeout(cooldown)
      simulation.on("tick", null)
      simulation.on("end", null)
      simulation.stop()
    }
  }, [canvasHeight, canvasWidth, focusNodeId, renderGraph, rendererReadyTick])

  if (!renderGraph || !focusNodeId) {
    return <div className="empty-state">没有可显示的图谱数据。</div>
  }

  return (
    <div className={`lite-graph ${variant === "global" ? "lite-graph-global" : ""}`}>
      <div className="lite-graph-toolbar">
        <div className="badge-row">
          <span className="badge">{`节点 ${renderGraph.nodes.length}`}</span>
          <span className="badge">{`边 ${renderGraph.edges.length}`}</span>
          <span className="badge">{depth === 1 ? "1 跳" : "2 跳"}</span>
          <span className="badge">{variant === "global" ? "全局视图" : "局部视图"}</span>
        </div>
        <div className="lite-graph-controls">
          <div className="graph-pill-row">
            <button type="button" className="graph-pill" data-active={depth === 1} onClick={() => setDepth(1)}>
              1 跳
            </button>
            <button type="button" className="graph-pill" data-active={depth === 2} onClick={() => setDepth(2)}>
              2 跳
            </button>
            <button
              type="button"
              className="graph-pill"
              data-active="false"
              onClick={() => {
                viewRef.current = { x: canvasWidth / 2, y: canvasHeight / 2, scale: 1 }
                if (worldRef.current) {
                  worldRef.current.position.set(viewRef.current.x, viewRef.current.y)
                  worldRef.current.scale.set(1)
                }
                scheduleRender()
              }}
            >
              重置视图
            </button>
            {rootNode && focusNodeId !== rootNode.id && (
              <button
                type="button"
                className="graph-pill"
                data-active="false"
                onClick={() => {
                  focusNode(rootNode.id)
                  setSearchValue(rootNode.label)
                }}
              >
                返回根节点
              </button>
            )}
            {selectedNode && analysisHref(sourceId, mode, selectedNode) && (
              <Link href={analysisHref(sourceId, mode, selectedNode)!} className="graph-inline-link" prefetch={false}>
                打开当前节点
              </Link>
            )}
            {variant === "local" && onOpenGlobal && (
              <button type="button" className="graph-pill" data-active="false" onClick={onOpenGlobal}>
                打开全局图
              </button>
            )}
            {variant === "global" && onCloseGlobal && (
              <button type="button" className="graph-pill" data-active="false" onClick={onCloseGlobal}>
                关闭
              </button>
            )}
          </div>

          <form className="graph-focus-form" onSubmit={handleFocusSubmit}>
            <input
              type="text"
              className="graph-focus-input"
              list={graphPickerId}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={variant === "global" ? "按名称定位节点" : "切换到其他节点"}
            />
            <datalist id={graphPickerId}>
              {graphOptions.map((node) => (
                <option key={node.id} value={node.label} />
              ))}
            </datalist>
            <button type="submit" className="graph-pill" data-active="false">
              定位
            </button>
          </form>
        </div>
      </div>

      <div ref={containerRef} className={`lite-graph-shell ${variant === "global" ? "lite-graph-shell-global" : ""}`} />

      {selectedNode && (
        <div className="lite-graph-meta">
          <div className="result-card">
            <h3>{selectedNode.label}</h3>
            <p>{groupLabels[selectedNode.group] ?? selectedNode.group}</p>
            <div className="badge-row">
              <span className="badge">{`连接度 ${renderGraph.degreeMap.get(selectedNode.id) ?? 0}`}</span>
              <span className="badge">{`权重 ${selectedNode.weight}`}</span>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="graph-inline-button"
                onClick={() => {
                  focusNode(selectedNode.id)
                }}
              >
                设为中心
              </button>
              {analysisHref(sourceId, mode, selectedNode) && (
                <Link href={analysisHref(sourceId, mode, selectedNode)!} className="ghost-link" prefetch={false}>
                  打开节点
                </Link>
              )}
            </div>
            <div className="action-row">
              {analysisSectionHref(sourceId, mode, selectedNode, "related") && (
                <Link
                  href={analysisSectionHref(sourceId, mode, selectedNode, "related")!}
                  className="ghost-link"
                  prefetch={false}
                >
                  相关关系
                </Link>
              )}
              {analysisSectionHref(sourceId, mode, selectedNode, "impact") && (
                <Link
                  href={analysisSectionHref(sourceId, mode, selectedNode, "impact")!}
                  className="ghost-link"
                  prefetch={false}
                >
                  影响分析
                </Link>
              )}
              {analysisSectionHref(sourceId, mode, selectedNode, "evidence") && (
                <Link
                  href={analysisSectionHref(sourceId, mode, selectedNode, "evidence")!}
                  className="ghost-link"
                  prefetch={false}
                >
                  证据文档
                </Link>
              )}
            </div>
          </div>

          <div className="result-card">
            <h3>邻近节点</h3>
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
                  <small>{`${groupLabels[peer.group] ?? peer.group} · 权重 ${edgeWeight(edge)}`}</small>
                </button>
              ))}
              {selectedConnections.length === 0 && <div className="empty-state">当前视图中没有可见邻居。</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
