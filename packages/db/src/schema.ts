export const createSourcesTableSql = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export const createDocumentsTableSql = `
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  headings JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, relative_path)
);
`

export const createDocumentIndexesSql = `
CREATE INDEX IF NOT EXISTS documents_source_id_idx ON documents(source_id);
CREATE INDEX IF NOT EXISTS documents_slug_idx ON documents(source_id, slug);
CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents(updated_at DESC);
`

export const createEntitiesTableSql = `
CREATE TABLE IF NOT EXISTS entities (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  entity_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  slug TEXT,
  document_slug TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, entity_key)
);
`

export const createEntityIndexesSql = `
CREATE INDEX IF NOT EXISTS entities_source_id_idx ON entities(source_id);
CREATE INDEX IF NOT EXISTS entities_type_idx ON entities(source_id, entity_type);
CREATE INDEX IF NOT EXISTS entities_slug_idx ON entities(source_id, slug);
CREATE INDEX IF NOT EXISTS entities_document_slug_idx ON entities(source_id, document_slug);
`

export const createRelationsTableSql = `
CREATE TABLE IF NOT EXISTS relations (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relation_key TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  from_entity_key TEXT NOT NULL,
  to_entity_key TEXT NOT NULL,
  evidence_document_slug TEXT,
  weight INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, relation_key)
);
`

export const createRelationIndexesSql = `
CREATE INDEX IF NOT EXISTS relations_source_id_idx ON relations(source_id);
CREATE INDEX IF NOT EXISTS relations_type_idx ON relations(source_id, relation_type);
CREATE INDEX IF NOT EXISTS relations_from_idx ON relations(source_id, from_entity_key);
CREATE INDEX IF NOT EXISTS relations_to_idx ON relations(source_id, to_entity_key);
CREATE INDEX IF NOT EXISTS relations_evidence_idx ON relations(source_id, evidence_document_slug);
`

export const createSyncRunsTableSql = `
CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);
`

export const createSyncRunIndexesSql = `
CREATE INDEX IF NOT EXISTS sync_runs_source_id_idx ON sync_runs(source_id);
CREATE INDEX IF NOT EXISTS sync_runs_started_at_idx ON sync_runs(started_at DESC);
`

export const createWorkspaceViewsTableSql = `
CREATE TABLE IF NOT EXISTS workspace_views (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout_mode TEXT NOT NULL DEFAULT 'local',
  owner TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export const createWorkspaceViewIndexesSql = `
CREATE INDEX IF NOT EXISTS workspace_views_created_at_idx ON workspace_views(created_at DESC);
CREATE INDEX IF NOT EXISTS workspace_views_updated_at_idx ON workspace_views(updated_at DESC);
CREATE INDEX IF NOT EXISTS workspace_views_source_scope_idx ON workspace_views USING GIN (source_scope);
`

export const createWorkspaceNodesTableSql = `
CREATE TABLE IF NOT EXISTS workspace_nodes (
  id BIGSERIAL PRIMARY KEY,
  workspace_view_id BIGINT NOT NULL REFERENCES workspace_views(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  entity_key TEXT,
  document_slug TEXT,
  reference_url TEXT,
  label TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  collapsed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export const createWorkspaceNodeIndexesSql = `
CREATE INDEX IF NOT EXISTS workspace_nodes_view_id_idx ON workspace_nodes(workspace_view_id);
CREATE INDEX IF NOT EXISTS workspace_nodes_entity_key_idx ON workspace_nodes(workspace_view_id, entity_key);
CREATE INDEX IF NOT EXISTS workspace_nodes_document_slug_idx ON workspace_nodes(workspace_view_id, document_slug);
`

export const createWorkspaceEdgesTableSql = `
CREATE TABLE IF NOT EXISTS workspace_edges (
  id BIGSERIAL PRIMARY KEY,
  workspace_view_id BIGINT NOT NULL REFERENCES workspace_views(id) ON DELETE CASCADE,
  from_node_id BIGINT NOT NULL REFERENCES workspace_nodes(id) ON DELETE CASCADE,
  to_node_id BIGINT NOT NULL REFERENCES workspace_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'manual',
  weight INTEGER NOT NULL DEFAULT 1,
  source_relation_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export const createWorkspaceEdgeIndexesSql = `
CREATE INDEX IF NOT EXISTS workspace_edges_view_id_idx ON workspace_edges(workspace_view_id);
CREATE INDEX IF NOT EXISTS workspace_edges_from_node_idx ON workspace_edges(workspace_view_id, from_node_id);
CREATE INDEX IF NOT EXISTS workspace_edges_to_node_idx ON workspace_edges(workspace_view_id, to_node_id);
CREATE INDEX IF NOT EXISTS workspace_edges_relation_key_idx ON workspace_edges(workspace_view_id, source_relation_key);
`

export const createWorkspaceAnnotationsTableSql = `
CREATE TABLE IF NOT EXISTS workspace_annotations (
  id BIGSERIAL PRIMARY KEY,
  workspace_view_id BIGINT NOT NULL REFERENCES workspace_views(id) ON DELETE CASCADE,
  workspace_node_id BIGINT REFERENCES workspace_nodes(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export const createWorkspaceAnnotationIndexesSql = `
CREATE INDEX IF NOT EXISTS workspace_annotations_view_id_idx ON workspace_annotations(workspace_view_id);
CREATE INDEX IF NOT EXISTS workspace_annotations_node_id_idx ON workspace_annotations(workspace_node_id);
CREATE INDEX IF NOT EXISTS workspace_annotations_created_at_idx ON workspace_annotations(created_at DESC);
`

export const initialSchemaSql = [
  createSourcesTableSql,
  createDocumentsTableSql,
  createDocumentIndexesSql,
  createEntitiesTableSql,
  createEntityIndexesSql,
  createRelationsTableSql,
  createRelationIndexesSql,
  createSyncRunsTableSql,
  createSyncRunIndexesSql,
  createWorkspaceViewsTableSql,
  createWorkspaceViewIndexesSql,
  createWorkspaceNodesTableSql,
  createWorkspaceNodeIndexesSql,
  createWorkspaceEdgesTableSql,
  createWorkspaceEdgeIndexesSql,
  createWorkspaceAnnotationsTableSql,
  createWorkspaceAnnotationIndexesSql,
]
