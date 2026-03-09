# Roadmap

## Phase 1: Dynamic Site Baseline

- local directory connector
- Next.js application shell
- Explorer
- document page
- search
- simplified graph

Status:

- completed and running

## Phase 2: Persistence and Operations

- PostgreSQL integration
- snapshot persistence
- sync run tracking
- database-first read path
- admin console
- local watcher

Status:

- `sources`, `documents`, and `sync_runs` are in place
- manual persistence and watcher-triggered persistence are available
- overview, search, document page, Explorer, and graph can read from PostgreSQL first
- `/admin` is available

Next:

1. improve persisted projections for graph and Explorer
2. move watcher behavior toward incremental sync
3. expand the GitHub connector from baseline to operational sync

## Phase 2.5: Nervous System Baseline

- `entities` and `relations` persistence
- extraction from tags and internal links
- typed extraction from tags, titles, paths, and transcript speakers
- `related`, `impact`, and `evidence` APIs
- integrated knowledge analysis page
- dual-mode graph page with local exploration

Status:

- `/source/[sourceId]/knowledge` is live
- `/source/[sourceId]/graph` supports `documents` and `knowledge` modes
- graph view now supports group filters, relation-type filters, local neighborhood scope, focused node exploration, evidence jumps, draggable pinned nodes, dense-view collapse controls, and richer detail panels with evidence previews
- graph rendering has moved from the original SVG interaction layer to a dedicated Sigma plus Graphology engine with continuous hover, focus, drag, zoom, and highlight transitions
- knowledge analysis now supports relation-type slicing, direction slicing, impact entity-type slicing, and evidence pivots without leaving the current root node
- person extraction has been tightened to reduce noisy topical nodes from tags and transcript headings
- structured concept and project extraction now filters long descriptive section titles more aggressively
- tag-level concept and project extraction now filters setup and application-note labels more aggressively

Next:

1. add more pivots around evidence and entity types
2. prepare the first GitHub connector baseline
3. add richer evidence bundles and multi-root comparisons into the analysis page

## Phase 2.6: Workspace Node Layer

- workspace view schema
- saved graph layouts
- pinned nodes
- node annotations
- manual overlay relations

Status:

- technical design is now defined
- `W1` schema and repository primitives are now in place
- `W2` read overlay is now in place on `/source/[sourceId]/graph`
- workspace views can now be listed and loaded through `/api/workspaces` and `/api/workspaces/[workspaceId]`
- saved node positions, pinned state, and manual overlay nodes or edges can now be layered onto the extracted graph
- write-side workspace UI has not started yet

Milestones:

1. `W1` add workspace tables and repository interfaces
2. `W2` load workspace overlays on top of the current graph page
3. `W3` support save view / pin node / add note / add manual relation
4. `W4` extend workspace scope from single source to multi-source
5. `W5` expose workspace APIs to future AI and tool layers

## Phase 3: Multi-Source Federation

- GitHub connector
- remote server connector
- incremental sync
- cross-source search

Status:

- GitHub connector baseline is now in place for public repositories
- source type `github` can now build snapshots through the existing connector factory
- private repo auth, webhook sync, and cross-source search are still pending

## Phase 4: Intelligence Layer

- AI summaries
- semantic search
- richer relation extraction
- federated knowledge graph

## Phase 5: Collaboration and Access Control

- permissions
- collaborative editing
- team and tenant boundaries
