import {
  CreateWorkspaceAnnotationInput,
  CreateWorkspaceEdgeInput,
  CreateWorkspaceNodeInput,
  CreateWorkspaceViewInput,
  UpdateWorkspaceNodeLayoutInput,
  WorkspaceAnnotation,
  WorkspaceEdge,
  WorkspaceNode,
  WorkspaceView,
  WorkspaceViewSummary,
} from "../../core/src"
import { withPgClient } from "./client"

type CreateWorkspaceCaptureInput = {
  view: CreateWorkspaceViewInput
  nodes: Array<
    Omit<CreateWorkspaceNodeInput, "workspaceViewId"> & {
      graphId: string
    }
  >
  edges: Array<
    Omit<CreateWorkspaceEdgeInput, "workspaceViewId" | "fromNodeId" | "toNodeId"> & {
      fromGraphId: string
      toGraphId: string
    }
  >
}

type WorkspaceViewRow = {
  id: string
  name: string
  description: string | null
  source_scope: unknown
  layout_mode: WorkspaceViewSummary["layoutMode"]
  owner: string | null
  metadata: unknown
  created_at: string
  updated_at: string
}

type WorkspaceNodeRow = {
  id: string
  workspace_view_id: string
  node_type: WorkspaceNode["nodeType"]
  entity_key: string | null
  document_slug: string | null
  reference_url: string | null
  label: string
  x: number
  y: number
  pinned: boolean
  collapsed: boolean
  metadata: unknown
  created_at: string
  updated_at: string
}

type WorkspaceEdgeRow = {
  id: string
  workspace_view_id: string
  from_node_id: string
  to_node_id: string
  edge_type: WorkspaceEdge["edgeType"]
  weight: number
  source_relation_key: string | null
  metadata: unknown
  created_at: string
  updated_at: string
}

type WorkspaceAnnotationRow = {
  id: string
  workspace_view_id: string
  workspace_node_id: string | null
  body: string
  kind: WorkspaceAnnotation["kind"]
  metadata: unknown
  created_at: string
  updated_at: string
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function mapWorkspaceViewRow(row: WorkspaceViewRow): WorkspaceViewSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    sourceScope: {
      sourceIds: asStringArray(row.source_scope),
    },
    layoutMode: row.layout_mode,
    owner: row.owner ?? undefined,
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWorkspaceNodeRow(row: WorkspaceNodeRow): WorkspaceNode {
  return {
    id: row.id,
    workspaceViewId: row.workspace_view_id,
    nodeType: row.node_type,
    entityKey: row.entity_key ?? undefined,
    documentSlug: row.document_slug ?? undefined,
    referenceUrl: row.reference_url ?? undefined,
    label: row.label,
    x: row.x,
    y: row.y,
    pinned: row.pinned,
    collapsed: row.collapsed,
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWorkspaceEdgeRow(row: WorkspaceEdgeRow): WorkspaceEdge {
  return {
    id: row.id,
    workspaceViewId: row.workspace_view_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    edgeType: row.edge_type,
    weight: row.weight,
    sourceRelationKey: row.source_relation_key ?? undefined,
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWorkspaceAnnotationRow(row: WorkspaceAnnotationRow): WorkspaceAnnotation {
  return {
    id: row.id,
    workspaceViewId: row.workspace_view_id,
    workspaceNodeId: row.workspace_node_id ?? undefined,
    body: row.body,
    kind: row.kind,
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listWorkspaceViews(input?: { sourceId?: string }) {
  return withPgClient(async (client) => {
    const result = await client.query<WorkspaceViewRow>(
      `
        SELECT id, name, description, source_scope, layout_mode, owner, metadata, created_at::text, updated_at::text
        FROM workspace_views
        WHERE ($1::text IS NULL OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(source_scope) AS source_id(value)
          WHERE source_id.value = $1
        ))
        ORDER BY updated_at DESC, id DESC
      `,
      [input?.sourceId ?? null],
    )

    return result.rows.map(mapWorkspaceViewRow)
  })
}

export async function getWorkspaceView(workspaceViewId: string): Promise<WorkspaceView | null> {
  return withPgClient(async (client) => {
    const [viewResult, nodesResult, edgesResult, annotationsResult] = await Promise.all([
      client.query<WorkspaceViewRow>(
        `
          SELECT id, name, description, source_scope, layout_mode, owner, metadata, created_at::text, updated_at::text
          FROM workspace_views
          WHERE id = $1
          LIMIT 1
        `,
        [workspaceViewId],
      ),
      client.query<WorkspaceNodeRow>(
        `
          SELECT
            id,
            workspace_view_id,
            node_type,
            entity_key,
            document_slug,
            reference_url,
            label,
            x,
            y,
            pinned,
            collapsed,
            metadata,
            created_at::text,
            updated_at::text
          FROM workspace_nodes
          WHERE workspace_view_id = $1
          ORDER BY id ASC
        `,
        [workspaceViewId],
      ),
      client.query<WorkspaceEdgeRow>(
        `
          SELECT
            id,
            workspace_view_id,
            from_node_id,
            to_node_id,
            edge_type,
            weight,
            source_relation_key,
            metadata,
            created_at::text,
            updated_at::text
          FROM workspace_edges
          WHERE workspace_view_id = $1
          ORDER BY id ASC
        `,
        [workspaceViewId],
      ),
      client.query<WorkspaceAnnotationRow>(
        `
          SELECT
            id,
            workspace_view_id,
            workspace_node_id,
            body,
            kind,
            metadata,
            created_at::text,
            updated_at::text
          FROM workspace_annotations
          WHERE workspace_view_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [workspaceViewId],
      ),
    ])

    const viewRow = viewResult.rows[0]
    if (!viewRow) {
      return null
    }

    return {
      ...mapWorkspaceViewRow(viewRow),
      nodes: nodesResult.rows.map(mapWorkspaceNodeRow),
      edges: edgesResult.rows.map(mapWorkspaceEdgeRow),
      annotations: annotationsResult.rows.map(mapWorkspaceAnnotationRow),
    }
  })
}

export async function createWorkspaceView(input: CreateWorkspaceViewInput) {
  return withPgClient(async (client) => {
    const result = await client.query<WorkspaceViewRow>(
      `
        INSERT INTO workspace_views (name, description, source_scope, layout_mode, owner, metadata, updated_at)
        VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, NOW())
        RETURNING id, name, description, source_scope, layout_mode, owner, metadata, created_at::text, updated_at::text
      `,
      [
        input.name,
        input.description ?? null,
        JSON.stringify(input.sourceScope.sourceIds ?? []),
        input.layoutMode ?? "local",
        input.owner ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    )

    return mapWorkspaceViewRow(result.rows[0])
  })
}

export async function createWorkspaceNode(input: CreateWorkspaceNodeInput) {
  return withPgClient(async (client) => {
    const result = await client.query<WorkspaceNodeRow>(
      `
        INSERT INTO workspace_nodes (
          workspace_view_id,
          node_type,
          entity_key,
          document_slug,
          reference_url,
          label,
          x,
          y,
          pinned,
          collapsed,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
        RETURNING
          id,
          workspace_view_id,
          node_type,
          entity_key,
          document_slug,
          reference_url,
          label,
          x,
          y,
          pinned,
          collapsed,
          metadata,
          created_at::text,
          updated_at::text
      `,
      [
        input.workspaceViewId,
        input.nodeType,
        input.entityKey ?? null,
        input.documentSlug ?? null,
        input.referenceUrl ?? null,
        input.label,
        input.x ?? 0,
        input.y ?? 0,
        input.pinned ?? false,
        input.collapsed ?? false,
        JSON.stringify(input.metadata ?? {}),
      ],
    )

    return mapWorkspaceNodeRow(result.rows[0])
  })
}

export async function updateWorkspaceNodeLayout(workspaceViewId: string, nodes: UpdateWorkspaceNodeLayoutInput[]) {
  if (nodes.length === 0) {
    return
  }

  await withPgClient(async (client) => {
    await client.query("BEGIN")
    try {
      for (const node of nodes) {
        await client.query(
          `
            UPDATE workspace_nodes
            SET x = $3,
                y = $4,
                pinned = COALESCE($5, pinned),
                collapsed = COALESCE($6, collapsed),
                updated_at = NOW()
            WHERE workspace_view_id = $1
              AND id = $2
          `,
          [workspaceViewId, node.nodeId, node.x, node.y, node.pinned ?? null, node.collapsed ?? null],
        )
      }

      await client.query(`UPDATE workspace_views SET updated_at = NOW() WHERE id = $1`, [workspaceViewId])
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  })
}

export async function createWorkspaceEdge(input: CreateWorkspaceEdgeInput) {
  return withPgClient(async (client) => {
    const result = await client.query<WorkspaceEdgeRow>(
      `
        INSERT INTO workspace_edges (
          workspace_view_id,
          from_node_id,
          to_node_id,
          edge_type,
          weight,
          source_relation_key,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
        RETURNING
          id,
          workspace_view_id,
          from_node_id,
          to_node_id,
          edge_type,
          weight,
          source_relation_key,
          metadata,
          created_at::text,
          updated_at::text
      `,
      [
        input.workspaceViewId,
        input.fromNodeId,
        input.toNodeId,
        input.edgeType ?? "manual",
        input.weight ?? 1,
        input.sourceRelationKey ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    )

    return mapWorkspaceEdgeRow(result.rows[0])
  })
}

export async function createWorkspaceAnnotation(input: CreateWorkspaceAnnotationInput) {
  return withPgClient(async (client) => {
    const result = await client.query<WorkspaceAnnotationRow>(
      `
        INSERT INTO workspace_annotations (
          workspace_view_id,
          workspace_node_id,
          body,
          kind,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
        RETURNING
          id,
          workspace_view_id,
          workspace_node_id,
          body,
          kind,
          metadata,
          created_at::text,
          updated_at::text
      `,
      [
        input.workspaceViewId,
        input.workspaceNodeId ?? null,
        input.body,
        input.kind ?? "note",
        JSON.stringify(input.metadata ?? {}),
      ],
    )

    return mapWorkspaceAnnotationRow(result.rows[0])
  })
}

export async function createWorkspaceCapture(input: CreateWorkspaceCaptureInput): Promise<WorkspaceView> {
  return withPgClient(async (client) => {
    await client.query("BEGIN")
    try {
      const viewResult = await client.query<WorkspaceViewRow>(
        `
          INSERT INTO workspace_views (name, description, source_scope, layout_mode, owner, metadata, updated_at)
          VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, NOW())
          RETURNING id, name, description, source_scope, layout_mode, owner, metadata, created_at::text, updated_at::text
        `,
        [
          input.view.name,
          input.view.description ?? null,
          JSON.stringify(input.view.sourceScope.sourceIds ?? []),
          input.view.layoutMode ?? "local",
          input.view.owner ?? null,
          JSON.stringify(input.view.metadata ?? {}),
        ],
      )

      const view = mapWorkspaceViewRow(viewResult.rows[0])
      const graphToWorkspaceNodeId = new Map<string, string>()
      const nodes: WorkspaceNode[] = []

      for (const node of input.nodes) {
        const nodeResult = await client.query<WorkspaceNodeRow>(
          `
            INSERT INTO workspace_nodes (
              workspace_view_id,
              node_type,
              entity_key,
              document_slug,
              reference_url,
              label,
              x,
              y,
              pinned,
              collapsed,
              metadata,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
            RETURNING
              id,
              workspace_view_id,
              node_type,
              entity_key,
              document_slug,
              reference_url,
              label,
              x,
              y,
              pinned,
              collapsed,
              metadata,
              created_at::text,
              updated_at::text
          `,
          [
            view.id,
            node.nodeType,
            node.entityKey ?? null,
            node.documentSlug ?? null,
            node.referenceUrl ?? null,
            node.label,
            node.x ?? 0,
            node.y ?? 0,
            node.pinned ?? false,
            node.collapsed ?? false,
            JSON.stringify(node.metadata ?? {}),
          ],
        )

        const savedNode = mapWorkspaceNodeRow(nodeResult.rows[0])
        graphToWorkspaceNodeId.set(node.graphId, savedNode.id)
        nodes.push(savedNode)
      }

      const edges: WorkspaceEdge[] = []
      for (const edge of input.edges) {
        const fromNodeId = graphToWorkspaceNodeId.get(edge.fromGraphId)
        const toNodeId = graphToWorkspaceNodeId.get(edge.toGraphId)
        if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
          continue
        }

        const edgeResult = await client.query<WorkspaceEdgeRow>(
          `
            INSERT INTO workspace_edges (
              workspace_view_id,
              from_node_id,
              to_node_id,
              edge_type,
              weight,
              source_relation_key,
              metadata,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
            RETURNING
              id,
              workspace_view_id,
              from_node_id,
              to_node_id,
              edge_type,
              weight,
              source_relation_key,
              metadata,
              created_at::text,
              updated_at::text
          `,
          [
            view.id,
            fromNodeId,
            toNodeId,
            edge.edgeType ?? "manual",
            edge.weight ?? 1,
            edge.sourceRelationKey ?? null,
            JSON.stringify(edge.metadata ?? {}),
          ],
        )

        edges.push(mapWorkspaceEdgeRow(edgeResult.rows[0]))
      }

      await client.query("COMMIT")

      return {
        ...view,
        nodes,
        edges,
        annotations: [],
      }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  })
}
