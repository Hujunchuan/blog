"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { KnowledgeGraphEdge, KnowledgeGraphMode, KnowledgeGraphNode, WorkspaceView } from "@repo/core/types"

const QuartzGraphView = dynamic(
  () => import("@/components/quartz-graph-view").then((module) => module.QuartzGraphView),
  {
    ssr: false,
    loading: () => <div className="empty-state">图谱加载中...</div>,
  },
)

export function GraphViewShell({
  sourceId,
  mode,
  graph,
  initialFocus,
  workspace,
}: {
  sourceId: string
  mode: KnowledgeGraphMode
  graph: {
    nodes: KnowledgeGraphNode[]
    edges: KnowledgeGraphEdge[]
  }
  initialFocus?: string
  workspace?: WorkspaceView | null
}) {
  const [globalOpen, setGlobalOpen] = useState(false)
  const [focusNodeId, setFocusNodeId] = useState<string | undefined>(initialFocus)

  useEffect(() => {
    setFocusNodeId(initialFocus)
  }, [initialFocus])

  useEffect(() => {
    if (!globalOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGlobalOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [globalOpen])

  return (
    <>
      <QuartzGraphView
        sourceId={sourceId}
        mode={mode}
        graph={graph}
        workspace={workspace}
        initialFocus={focusNodeId}
        variant="local"
        onFocusChange={setFocusNodeId}
        onOpenGlobal={() => setGlobalOpen(true)}
      />

      {globalOpen && (
        <div className="graph-overlay" role="dialog" aria-modal="true" aria-label="全局图谱">
          <button
            type="button"
            className="graph-overlay-backdrop"
            aria-label="关闭全局图谱"
            onClick={() => setGlobalOpen(false)}
          />
          <div className="graph-overlay-panel">
            <QuartzGraphView
              sourceId={sourceId}
              mode={mode}
              graph={graph}
              workspace={workspace}
              initialFocus={focusNodeId}
              variant="global"
              onFocusChange={setFocusNodeId}
              onCloseGlobal={() => setGlobalOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
