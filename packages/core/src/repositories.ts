import {
  CreateWorkspaceAnnotationInput,
  CreateWorkspaceEdgeInput,
  CreateWorkspaceNodeInput,
  CreateWorkspaceViewInput,
  KnowledgeSnapshot,
  UpdateWorkspaceNodeLayoutInput,
  WorkspaceAnnotation,
  WorkspaceEdge,
  WorkspaceNode,
  WorkspaceView,
  WorkspaceViewSummary,
} from "./types"

export interface SnapshotRepository {
  get(sourceId: string): Promise<KnowledgeSnapshot | undefined>
  set(sourceId: string, snapshot: KnowledgeSnapshot): Promise<void>
  invalidate(sourceId?: string): Promise<void>
}

export interface WorkspaceRepository {
  listViews(input?: { sourceId?: string }): Promise<WorkspaceViewSummary[]>
  getView(workspaceViewId: string): Promise<WorkspaceView | undefined>
  createView(input: CreateWorkspaceViewInput): Promise<WorkspaceViewSummary>
  createNode(input: CreateWorkspaceNodeInput): Promise<WorkspaceNode>
  updateNodeLayout(workspaceViewId: string, nodes: UpdateWorkspaceNodeLayoutInput[]): Promise<void>
  createEdge(input: CreateWorkspaceEdgeInput): Promise<WorkspaceEdge>
  createAnnotation(input: CreateWorkspaceAnnotationInput): Promise<WorkspaceAnnotation>
}
