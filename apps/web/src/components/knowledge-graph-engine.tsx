"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import Graph from "graphology"
import Sigma from "sigma"
import type { EdgeProgramType } from "sigma/rendering"
import EdgeCurveProgram from "@sigma/edge-curve"
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from "d3-force"
import { KnowledgeGraphEdge } from "@repo/core/types"

type CanvasNode = {
  id: string
  label: string
  group: string
  weight: number
  x: number
  y: number
  radius: number
  color: string
}

type GraphNodeAttributes = {
  x: number
  y: number
  size: number
  originalSize: number
  label: string
  color: string
  originalColor: string
  group: string
  weight: number
  zIndex?: number
  forceLabel?: boolean
}

type GraphEdgeAttributes = {
  color: string
  originalColor: string
  size: number
  originalSize: number
  relationTypes: string[]
  evidenceDocumentSlugs: string[]
  weight: number
  zIndex?: number
  hidden?: boolean
}

type GraphAttributes = Record<string, never>

type ForceGraphNode = CanvasNode &
  SimulationNodeDatum & {
    anchorX: number
    anchorY: number
  }

type ForceGraphLink = SimulationLinkDatum<ForceGraphNode> & {
  source: ForceGraphNode
  target: ForceGraphNode
  weight: number
}

type MouseCoords = {
  x: number
  y: number
  original: MouseEvent | TouchEvent
  preventSigmaDefault(): void
}

type SigmaNodePayload = {
  node: string
  preventSigmaDefault(): void
}

export type KnowledgeGraphEngineHandle = {
  getNodePosition(nodeId: string): { x: number; y: number } | undefined
  focusNode(nodeId: string): void
  resetCamera(): void
}

function clampPosition(layoutWidth: number, layoutHeight: number, position: { x: number; y: number }) {
  return {
    x: Math.min(layoutWidth - 24, Math.max(24, position.x)),
    y: Math.min(layoutHeight - 24, Math.max(24, position.y)),
  }
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : { r: 80, g: 80, b: 92 }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`
}

function dimColor(hex: string, amount: number) {
  const rgb = hexToRgb(hex)
  const background = { r: 18, g: 18, b: 28 }
  return rgbToHex(
    background.r + (rgb.r - background.r) * amount,
    background.g + (rgb.g - background.g) * amount,
    background.b + (rgb.b - background.b) * amount,
  )
}

function brightenColor(hex: string, factor: number) {
  const rgb = hexToRgb(hex)
  return rgbToHex(
    rgb.r + ((255 - rgb.r) * (factor - 1)) / factor,
    rgb.g + ((255 - rgb.g) * (factor - 1)) / factor,
    rgb.b + ((255 - rgb.b) * (factor - 1)) / factor,
  )
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

export const KnowledgeGraphEngine = forwardRef<
  KnowledgeGraphEngineHandle,
  {
    width: number
    height: number
    nodes: CanvasNode[]
    edges: KnowledgeGraphEdge[]
    selectedNodeId?: string
    pinnedNodeIds: string[]
    onSelectNode(nodeId?: string): void
    onPinNode(nodeId: string, position: { x: number; y: number }): void
    onUnpinNode(nodeId: string): void
  }
>(function KnowledgeGraphEngine(
  { width, height, nodes, edges, selectedNodeId, pinnedNodeIds, onSelectNode, onPinNode, onUnpinNode },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sigmaRef = useRef<Sigma<GraphNodeAttributes, GraphEdgeAttributes, GraphAttributes> | null>(null)
  const graphRef = useRef<Graph<GraphNodeAttributes, GraphEdgeAttributes, GraphAttributes> | null>(null)
  const simulationRef = useRef<Simulation<ForceGraphNode, ForceGraphLink> | null>(null)
  const refreshFrameRef = useRef<number | null>(null)
  const highlightFrameRef = useRef<number | null>(null)
  const draggedNodeRef = useRef<string | null>(null)
  const hoveredNodeRef = useRef<string | null>(null)
  const selectedNodeRef = useRef<string | null>(selectedNodeId ?? null)
  const nodeMapRef = useRef<Map<string, ForceGraphNode>>(new Map())
  const pinnedSetRef = useRef<Set<string>>(new Set(pinnedNodeIds))
  const nodeIntensityRef = useRef<Map<string, number>>(new Map())
  const nodeTargetRef = useRef<Map<string, number>>(new Map())
  const edgeIntensityRef = useRef<Map<string, number>>(new Map())
  const edgeTargetRef = useRef<Map<string, number>>(new Map())
  const focusRequestRef = useRef<string | null>(null)
  const onSelectNodeRef = useRef(onSelectNode)
  const onPinNodeRef = useRef(onPinNode)
  const onUnpinNodeRef = useRef(onUnpinNode)

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode
    onPinNodeRef.current = onPinNode
    onUnpinNodeRef.current = onUnpinNode
  }, [onPinNode, onSelectNode, onUnpinNode])

  const scheduleRefresh = (skipIndexation = true) => {
    if (refreshFrameRef.current !== null) {
      return
    }

    refreshFrameRef.current = requestAnimationFrame(() => {
      refreshFrameRef.current = null
      sigmaRef.current?.refresh({ skipIndexation })
    })
  }

  const computeInteractionTargets = () => {
    const graph = graphRef.current
    if (!graph) {
      return
    }

    const hoveredNode = hoveredNodeRef.current
    const selectedNode = selectedNodeRef.current
    const activeNode = selectedNode ?? hoveredNode
    const neighborSet = new Set<string>()

    if (activeNode && graph.hasNode(activeNode)) {
      graph.forEachNeighbor(activeNode, (neighbor) => {
        neighborSet.add(neighbor)
      })
    }

    const nextNodeTargets = new Map<string, number>()
    graph.forEachNode((node) => {
      if (selectedNode) {
        if (node === selectedNode) {
          nextNodeTargets.set(node, 1)
        } else if (neighborSet.has(node)) {
          nextNodeTargets.set(node, 0.72)
        } else {
          nextNodeTargets.set(node, 0.12)
        }
        return
      }

      if (hoveredNode) {
        if (node === hoveredNode) {
          nextNodeTargets.set(node, 0.96)
        } else if (neighborSet.has(node)) {
          nextNodeTargets.set(node, 0.62)
        } else {
          nextNodeTargets.set(node, 0.18)
        }
        return
      }

      nextNodeTargets.set(node, 0.56)
    })

    const nextEdgeTargets = new Map<string, number>()
    graph.forEachEdge((edge, _attributes, source, target) => {
      if (selectedNode) {
        nextEdgeTargets.set(edge, source === selectedNode || target === selectedNode ? 1 : 0.08)
        return
      }

      if (hoveredNode) {
        nextEdgeTargets.set(edge, source === hoveredNode || target === hoveredNode ? 0.88 : 0.12)
        return
      }

      nextEdgeTargets.set(edge, 0.3)
    })

    nodeTargetRef.current = nextNodeTargets
    edgeTargetRef.current = nextEdgeTargets
  }

  const animateHighlights = () => {
    const graph = graphRef.current
    if (!graph) {
      highlightFrameRef.current = null
      return
    }

    let animating = false

    graph.forEachNode((node) => {
      const current = nodeIntensityRef.current.get(node) ?? 0.56
      const target = nodeTargetRef.current.get(node) ?? 0.56
      const next = current + (target - current) * 0.22
      if (Math.abs(next - target) > 0.015) {
        animating = true
      }
      nodeIntensityRef.current.set(node, next)
    })

    graph.forEachEdge((edge) => {
      const current = edgeIntensityRef.current.get(edge) ?? 0.3
      const target = edgeTargetRef.current.get(edge) ?? 0.3
      const next = current + (target - current) * 0.24
      if (Math.abs(next - target) > 0.02) {
        animating = true
      }
      edgeIntensityRef.current.set(edge, next)
    })

    scheduleRefresh(true)

    if (animating) {
      highlightFrameRef.current = requestAnimationFrame(animateHighlights)
    } else {
      highlightFrameRef.current = null
    }
  }

  const scheduleHighlightAnimation = () => {
    computeInteractionTargets()
    if (highlightFrameRef.current !== null) {
      return
    }
    highlightFrameRef.current = requestAnimationFrame(animateHighlights)
  }

  const focusNode = (nodeId: string) => {
    const sigma = sigmaRef.current
    const graph = graphRef.current
    if (!sigma || !graph || !graph.hasNode(nodeId)) {
      return
    }

    const { x, y } = graph.getNodeAttributes(nodeId)
    sigma.getCamera().animate(
      {
        x,
        y,
        ratio: 0.16,
      },
      { duration: 360 },
    )
  }

  useImperativeHandle(
    ref,
    () => ({
      getNodePosition(nodeId: string) {
        const graph = graphRef.current
        if (!graph || !graph.hasNode(nodeId)) {
          return undefined
        }

        const { x, y } = graph.getNodeAttributes(nodeId)
        return { x, y }
      },
      focusNode,
      resetCamera() {
        sigmaRef.current?.getCamera().animatedReset({ duration: 320 })
      },
    }),
    [],
  )

  useEffect(() => {
    if (!containerRef.current || sigmaRef.current) {
      return
    }

    const graph = new Graph<GraphNodeAttributes, GraphEdgeAttributes, GraphAttributes>()
    const sigma = new Sigma<GraphNodeAttributes, GraphEdgeAttributes, GraphAttributes>(graph, containerRef.current, {
      renderLabels: true,
      labelFont: "IBM Plex Sans, Noto Sans SC, sans-serif",
      labelSize: 12,
      labelWeight: "500",
      labelColor: { color: "#f4efe6" },
      labelRenderedSizeThreshold: 10,
      defaultNodeColor: "#7c8f8d",
      defaultEdgeColor: "#41595b",
      defaultEdgeType: "curved",
      edgeProgramClasses: {
        curved:
          EdgeCurveProgram as unknown as EdgeProgramType<
            GraphNodeAttributes,
            GraphEdgeAttributes,
            GraphAttributes
          >,
      },
      hideEdgesOnMove: false,
      minCameraRatio: 0.08,
      maxCameraRatio: 4,
      zIndex: true,
      nodeReducer: (node, data) => {
        const intensity = nodeIntensityRef.current.get(node) ?? 0.56
        const hovered = hoveredNodeRef.current === node
        const selected = selectedNodeRef.current === node
        const color = hovered || selected ? brightenColor(data.originalColor, selected ? 1.7 : 1.45) : dimColor(data.originalColor, 0.18 + intensity * 0.82)

        return {
          ...data,
          color,
          size: data.originalSize * (0.58 + intensity * 0.9 + (hovered ? 0.12 : 0) + (selected ? 0.22 : 0)),
          zIndex: Math.round(intensity * 10) + (hovered ? 6 : 0) + (selected ? 10 : 0),
          forceLabel: hovered || selected || intensity > 0.72,
        }
      },
      edgeReducer: (edge, data) => {
        const intensity = edgeIntensityRef.current.get(edge) ?? 0.3
        const color = intensity > 0.72 ? brightenColor(data.originalColor, 1.45) : dimColor(data.originalColor, 0.06 + intensity * 0.64)

        return {
          ...data,
          hidden: intensity < 0.05,
          color,
          size: Math.max(0.35, data.originalSize * (0.22 + intensity * 1.9)),
          zIndex: Math.round(intensity * 10),
        }
      },
    })

    const mouseCaptor = sigma.getMouseCaptor()
    const handleMoveBody = (event: MouseCoords) => {
      const draggedNode = draggedNodeRef.current
      const graph = graphRef.current
      const forceNode = draggedNode ? nodeMapRef.current.get(draggedNode) : undefined
      if (!draggedNode || !graph || !forceNode) {
        return
      }

      event.preventSigmaDefault()
      event.original.preventDefault()
      event.original.stopPropagation()

      const viewportPoint = sigma.viewportToGraph({ x: event.x, y: event.y })
      const nextPosition = clampPosition(width, height, viewportPoint)
      forceNode.x = nextPosition.x
      forceNode.y = nextPosition.y
      forceNode.fx = nextPosition.x
      forceNode.fy = nextPosition.y
      forceNode.anchorX = nextPosition.x
      forceNode.anchorY = nextPosition.y
      graph.mergeNodeAttributes(draggedNode, {
        x: nextPosition.x,
        y: nextPosition.y,
      })
      simulationRef.current?.alpha(0.34).restart()
      scheduleRefresh(true)
    }

    const handleMouseUp = () => {
      const draggedNode = draggedNodeRef.current
      const graph = graphRef.current
      const forceNode = draggedNode ? nodeMapRef.current.get(draggedNode) : undefined
      if (!draggedNode || !graph || !forceNode) {
        return
      }

      const nextPosition = clampPosition(width, height, {
        x: forceNode.x ?? forceNode.anchorX,
        y: forceNode.y ?? forceNode.anchorY,
      })
      forceNode.x = nextPosition.x
      forceNode.y = nextPosition.y
      forceNode.fx = nextPosition.x
      forceNode.fy = nextPosition.y
      graph.mergeNodeAttributes(draggedNode, {
        x: nextPosition.x,
        y: nextPosition.y,
      })
      onPinNodeRef.current(draggedNode, nextPosition)
      onSelectNodeRef.current(draggedNode)
      draggedNodeRef.current = null
      containerRef.current?.style.setProperty("cursor", "grab")
      scheduleRefresh(true)
    }

    sigma.on("clickNode", ({ node }: SigmaNodePayload) => {
      selectedNodeRef.current = node
      onSelectNodeRef.current(node)
      scheduleHighlightAnimation()
      focusNode(node)
    })

    sigma.on("doubleClickNode", ({ node, preventSigmaDefault }: SigmaNodePayload) => {
      preventSigmaDefault()
      const graph = graphRef.current
      const forceNode = nodeMapRef.current.get(node)
      if (!graph || !forceNode) {
        return
      }

      const nextPosition = clampPosition(width, height, {
        x: forceNode.x ?? forceNode.anchorX,
        y: forceNode.y ?? forceNode.anchorY,
      })

      if (pinnedSetRef.current.has(node)) {
        forceNode.fx = null
        forceNode.fy = null
        onUnpinNodeRef.current(node)
        simulationRef.current?.alpha(0.24).restart()
      } else {
        forceNode.fx = nextPosition.x
        forceNode.fy = nextPosition.y
        onPinNodeRef.current(node, nextPosition)
      }

      scheduleRefresh(true)
    })

    sigma.on("clickStage", () => {
      selectedNodeRef.current = null
      onSelectNodeRef.current(undefined)
      scheduleHighlightAnimation()
    })

    sigma.on("enterNode", ({ node }: SigmaNodePayload) => {
      hoveredNodeRef.current = node
      scheduleHighlightAnimation()
      if (containerRef.current) {
        containerRef.current.style.cursor = "pointer"
      }
    })

    sigma.on("leaveNode", () => {
      hoveredNodeRef.current = null
      scheduleHighlightAnimation()
      if (containerRef.current) {
        containerRef.current.style.cursor = "grab"
      }
    })

    sigma.on("downNode", ({ node, preventSigmaDefault }: SigmaNodePayload) => {
      const graph = graphRef.current
      const forceNode = nodeMapRef.current.get(node)
      if (!graph || !forceNode) {
        return
      }

      preventSigmaDefault()
      draggedNodeRef.current = node
      forceNode.fx = forceNode.x ?? forceNode.anchorX
      forceNode.fy = forceNode.y ?? forceNode.anchorY
      selectedNodeRef.current = node
      onSelectNodeRef.current(node)
      scheduleHighlightAnimation()
      containerRef.current?.style.setProperty("cursor", "grabbing")
      simulationRef.current?.alpha(0.38).restart()
    })

    mouseCaptor.on("mousemovebody", handleMoveBody)
    mouseCaptor.on("mouseup", handleMouseUp)

    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation()
    }
    containerRef.current.addEventListener("wheel", handleWheel, { passive: false })

    sigmaRef.current = sigma
    graphRef.current = graph

    return () => {
      containerRef.current?.removeEventListener("wheel", handleWheel)
      mouseCaptor.off("mousemovebody", handleMoveBody)
      mouseCaptor.off("mouseup", handleMouseUp)

      if (refreshFrameRef.current !== null) {
        cancelAnimationFrame(refreshFrameRef.current)
      }
      if (highlightFrameRef.current !== null) {
        cancelAnimationFrame(highlightFrameRef.current)
      }
      simulationRef.current?.stop()
      sigma.kill()
      sigmaRef.current = null
      graphRef.current = null
    }
  }, [height, width])

  useEffect(() => {
    selectedNodeRef.current = selectedNodeId ?? null
    if (selectedNodeId) {
      focusRequestRef.current = selectedNodeId
    }
    scheduleHighlightAnimation()
  }, [selectedNodeId])

  useEffect(() => {
    pinnedSetRef.current = new Set(pinnedNodeIds)
    for (const [nodeId, forceNode] of nodeMapRef.current) {
      if (pinnedSetRef.current.has(nodeId)) {
        const nextPosition = clampPosition(width, height, {
          x: forceNode.x ?? forceNode.anchorX,
          y: forceNode.y ?? forceNode.anchorY,
        })
        forceNode.fx = nextPosition.x
        forceNode.fy = nextPosition.y
      } else {
        forceNode.fx = null
        forceNode.fy = null
      }
    }
    simulationRef.current?.alpha(0.22).restart()
    scheduleRefresh(true)
  }, [height, pinnedNodeIds, width])

  useEffect(() => {
    const sigma = sigmaRef.current
    if (!sigma) {
      return
    }

    simulationRef.current?.stop()

    const graph = new Graph<GraphNodeAttributes, GraphEdgeAttributes, GraphAttributes>()
    const pinnedSet = new Set(pinnedNodeIds)
    const nodeMap = new Map<string, ForceGraphNode>()
    for (const node of nodes) {
      const clamped = clampPosition(width, height, { x: node.x, y: node.y })
      graph.addNode(node.id, {
        x: clamped.x,
        y: clamped.y,
        size: node.radius,
        originalSize: node.radius,
        label: node.label,
        color: node.color,
        originalColor: node.color,
        group: node.group,
        weight: node.weight,
      })

      const forceNode: ForceGraphNode = {
        ...node,
        x: clamped.x,
        y: clamped.y,
        anchorX: clamped.x,
        anchorY: clamped.y,
      }
      if (pinnedSet.has(node.id)) {
        forceNode.fx = clamped.x
        forceNode.fy = clamped.y
      }
      nodeMap.set(node.id, forceNode)
      nodeIntensityRef.current.set(node.id, nodeIntensityRef.current.get(node.id) ?? 0.56)
    }

    edges.forEach((edge, index) => {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
        return
      }

      const key = `${edge.source}__${edge.target}__${index}`
      graph.addEdgeWithKey(key, edge.source, edge.target, {
        color: "#3a5758",
        originalColor: "#3a5758",
        size: Math.max(0.8, edgeWeight(edge) * 0.8),
        originalSize: Math.max(0.8, edgeWeight(edge) * 0.8),
        relationTypes: edgeRelationTypes(edge),
        evidenceDocumentSlugs: edgeEvidenceSlugs(edge),
        weight: edgeWeight(edge),
      })
      edgeIntensityRef.current.set(key, edgeIntensityRef.current.get(key) ?? 0.3)
    })

    const forceLinks: ForceGraphLink[] = edges.flatMap((edge) => {
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

    const simulation = forceSimulation<ForceGraphNode, ForceGraphLink>([...nodeMap.values()])
      .alpha(0.85)
      .alphaMin(0.04)
      .alphaDecay(0.045)
      .velocityDecay(0.24)
      .force(
        "charge",
        forceManyBody<ForceGraphNode>().strength((node) => -280 - Math.min(node.weight, 8) * 18),
      )
      .force(
        "link",
        forceLink<ForceGraphNode, ForceGraphLink>(forceLinks)
          .distance((link) => Math.max(52, 108 - Math.min(link.weight, 6) * 8))
          .strength((link) => Math.min(0.78, 0.2 + link.weight * 0.08)),
      )
      .force("collide", forceCollide<ForceGraphNode>().radius((node) => node.radius + 12).iterations(2))
      .force("center", forceCenter(width / 2, height / 2).strength(0.08))
      .force("anchor-x", forceX<ForceGraphNode>((node) => node.anchorX).strength((node) => (pinnedSet.has(node.id) ? 0.26 : 0.06)))
      .force("anchor-y", forceY<ForceGraphNode>((node) => node.anchorY).strength((node) => (pinnedSet.has(node.id) ? 0.26 : 0.06)))

    simulation.on("tick", () => {
      for (const [nodeId, forceNode] of nodeMap) {
        const nextPosition = clampPosition(width, height, {
          x: forceNode.x ?? forceNode.anchorX,
          y: forceNode.y ?? forceNode.anchorY,
        })
        forceNode.x = nextPosition.x
        forceNode.y = nextPosition.y
        graph.mergeNodeAttributes(nodeId, {
          x: nextPosition.x,
          y: nextPosition.y,
        })
      }
      scheduleRefresh(true)
    })

    simulation.on("end", () => {
      scheduleRefresh(true)
    })

    graphRef.current = graph
    nodeMapRef.current = nodeMap
    simulationRef.current = simulation
    sigma.setGraph(graph)
    scheduleHighlightAnimation()

    const focusNodeId = focusRequestRef.current ?? selectedNodeRef.current
    if (focusNodeId && graph.hasNode(focusNodeId)) {
      focusNode(focusNodeId)
      focusRequestRef.current = null
    } else {
      sigma.getCamera().animatedReset({ duration: 260 })
    }

    return () => {
      simulation.stop()
    }
  }, [edges, nodes, pinnedNodeIds, width, height])

  return <div ref={containerRef} className="graph-canvas" />
})
