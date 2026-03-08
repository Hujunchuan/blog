"use client"

import dynamic from "next/dynamic"
import { KnowledgeGraphMode, KnowledgeGraphNode, KnowledgeGraphEdge } from "@repo/core/types"

const QuartzGraphView = dynamic(
  () => import("@/components/quartz-graph-view").then((module) => module.QuartzGraphView),
  {
    ssr: false,
    loading: () => <div className="empty-state">Loading graph...</div>,
  },
)

export function GraphViewShell({
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
  return <QuartzGraphView sourceId={sourceId} mode={mode} graph={graph} initialFocus={initialFocus} />
}
