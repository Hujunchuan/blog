# Workspace Node Plan

## Background

The current nervous-system layer already supports:

- documents
- entities
- relations
- related / impact / evidence queries
- local graph exploration

That is enough for a typed knowledge graph, but it is still mostly a read-only projection.

The Neurite-style upgrade worth borrowing is not its visual style. The real upgrade is to turn the graph into a persistent workspace layer where a node is not only something extracted from Markdown, but also something that can be arranged, pinned, grouped, annotated, and used as a working surface.

This document defines that workspace-node layer as the next technical step.

## Goal

Add a workspace layer on top of the existing nervous system so the platform can support:

- multiple saved graph views
- manually pinned and arranged nodes
- operator annotations and manual relations
- reusable investigation contexts
- later AI or tool-driven workspace actions

## Non-Goals

This phase does not try to:

- replace the existing entity / relation model
- replace the current graph rendering stack immediately
- add a full collaborative canvas editor
- write graph edits back into Markdown frontmatter
- introduce a graph database

## Core Idea

The current model is:

- `documents`
- `entities`
- `relations`

The new layer adds:

- `workspace_views`
- `workspace_nodes`
- `workspace_edges`
- `workspace_annotations`

This means the knowledge graph remains the source of truth for extracted structure, while the workspace layer becomes the source of truth for how a human or agent wants to work with that structure.

## Node Types

The platform already has extracted knowledge entities such as:

- `document`
- `tag`
- `concept`
- `person`
- `project`

The workspace layer introduces a second notion of node:

- extracted node
- synthetic node
- reference node

### Extracted Node

Backed by an existing entity or document.

Examples:

- a document node
- a concept node
- a person node

### Synthetic Node

Created only for the workspace.

Examples:

- a temporary idea
- a research question
- a TODO cluster
- a hypothesis node

### Reference Node

Represents an external resource not yet normalized into the full knowledge pipeline.

Examples:

- a webpage
- a PDF
- a GitHub issue
- a meeting recording

## Data Model

### `workspace_views`

Represents a saved graph workspace.

Suggested fields:

- `id`
- `source_scope`
- `name`
- `description`
- `layout_mode`
- `owner`
- `created_at`
- `updated_at`

### `workspace_nodes`

Stores node-level workspace state.

Suggested fields:

- `id`
- `workspace_view_id`
- `source_id`
- `node_type`
- `entity_key`
- `document_slug`
- `reference_url`
- `label`
- `x`
- `y`
- `pinned`
- `collapsed`
- `metadata`

### `workspace_edges`

Stores manual or curated edges in a workspace.

Suggested fields:

- `id`
- `workspace_view_id`
- `from_node_id`
- `to_node_id`
- `edge_type`
- `weight`
- `source_relation_key`
- `metadata`

### `workspace_annotations`

Stores human notes attached to a workspace or node.

Suggested fields:

- `id`
- `workspace_view_id`
- `workspace_node_id`
- `body`
- `kind`
- `created_at`
- `updated_at`

## Read Path

The graph page should move toward a layered read path:

1. load the extracted graph or local subgraph
2. overlay workspace nodes and edges
3. apply saved layout state
4. render pinned and annotated state

This keeps the current extracted graph stable while allowing progressively richer graph workspaces.

## Write Path

The first write path should be intentionally narrow:

1. create a workspace view
2. pin or unpin a node
3. save node positions
4. create a manual note
5. create a manual relation

This gives immediate value without forcing bi-directional Markdown sync.

## API Milestone

The first API batch should be:

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/[workspaceId]`
- `POST /api/workspaces/[workspaceId]/layout`
- `POST /api/workspaces/[workspaceId]/notes`
- `POST /api/workspaces/[workspaceId]/relations`

These APIs should remain compatible with the current `related / impact / evidence` endpoints.

## UI Milestone

The first UI batch should be:

- save current graph view as workspace
- reopen a saved workspace
- pin node / release node
- attach note to focused node
- mark relation as curated

The graph should remain primarily a presentation surface, but gain a lightweight working-memory layer.

## Why This Helps the Nervous System

Without a workspace layer, the current graph can answer:

- what is connected
- what may be affected
- what evidence exists

With a workspace layer, it can also support:

- what the operator is currently investigating
- which nodes are considered core in this context
- which temporary hypotheses or TODOs exist
- which curated relation set belongs to this investigation

That is the real upgrade we want to borrow from Neurite.

## Milestones

### Milestone W1: Workspace Schema

- add workspace tables
- keep all existing knowledge APIs unchanged
- add repository-level create / list / get / layout update primitives
- no UI required yet

### Milestone W2: Workspace Read Overlay

- graph page can load a saved workspace
- node positions and pinned state are restored
- extracted graph remains the base layer

### Milestone W3: Workspace Editing

- save current view
- pin / unpin nodes
- add note to node
- add manual relation

### Milestone W4: Multi-Source Workspace

- one workspace can include nodes from multiple knowledge sources
- prepare for cross-source graph investigation

### Milestone W5: Tooling and Agent Actions

- expose workspace APIs for agent tooling
- support context-pack generation from a saved workspace

## Acceptance Criteria for the First Phase

The first workspace-node phase is complete when:

- a workspace can be created from the current graph page
- at least one focused node arrangement can be saved and reopened
- manual notes can be attached without editing Markdown
- the existing nervous-system APIs remain stable

## Current W1 Scope Landed

- workspace types are now defined in `packages/core`
- workspace tables are now part of the PostgreSQL schema bootstrap
- repository-level primitives are in place for:
  - create workspace view
  - list workspace views
  - read full workspace view
  - create workspace node
  - update node layout
  - create workspace edge
  - create workspace annotation

## Current W2 Scope Landed

- `GET /api/workspaces` is now available
- `GET /api/workspaces/[workspaceId]` is now available
- the graph page can now load a workspace overlay through the `workspace` query parameter
- saved node positions are now applied on top of the extracted graph
- saved pinned state is now applied on top of the extracted graph
- manual workspace-only nodes and edges can now be rendered as overlay state
- the extracted graph remains the base layer and workspace data is read as an additive overlay

## Remaining W2 Gaps

- there is not yet a UI to create or save a workspace from the graph page
- there is not yet a UI to pin or unpin nodes from the graph page
- there is not yet a UI to create manual notes or manual relations
- there is not yet a workspace switcher with editing actions

## Current W3 Slice Landed

- the graph page can now save the current visible subgraph as a new workspace
- saved views now persist node positions from the current rendered graph
- the focused node is carried into workspace metadata and saved as pinned state
- saved workspaces can be reopened immediately on the graph page through the existing `workspace` overlay flow
- an existing workspace can now be refreshed from the current visible subgraph
- focused graph nodes can now be pinned or released through the same workspace capture update flow
- node notes can now be created from the graph detail panel
- manual workspace relations can now be created from the graph detail panel

## Remaining W3 Gaps

- workspace editing still works as full capture replacement for layout and pin changes, not fine-grained node mutation

## Current W4 Slice Landed

- workspace nodes are now source-aware through `source_id`
- workspace capture and refresh now preserve per-node source ownership
- workspace `source_scope` is now derived from all nodes included in a saved view
- graph overlays can now distinguish same-source nodes from external-source nodes
- external-source workspace nodes no longer collide with current-source entity keys or document slugs
- graph-side node jumps now open the node in its owning source instead of always using the current graph page source
- the graph page can now search other configured knowledge sources and attach external nodes into the current workspace overlay
- selected external nodes can now expand one-hop neighbors from their owning source without switching away from the current graph page

## Remaining W4 Gaps

- expanded external neighbors are still added as lightweight overlay references rather than a full cross-source graph merge
- cross-source search and cross-source graph assembly are still pending
