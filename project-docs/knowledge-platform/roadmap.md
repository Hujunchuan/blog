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
3. prepare the GitHub connector baseline

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
- person extraction has been tightened to reduce noisy topical nodes from tags and transcript headings
- structured concept and project extraction now filters long descriptive section titles more aggressively
- tag-level concept and project extraction now filters setup and application-note labels more aggressively

Next:

1. add more pivots around evidence and entity types
2. prepare the first GitHub connector baseline
3. bring node-side evidence pivots and relation filters back into the analysis page

## Phase 3: Multi-Source Federation

- GitHub connector
- remote server connector
- incremental sync
- cross-source search

## Phase 4: Intelligence Layer

- AI summaries
- semantic search
- richer relation extraction
- federated knowledge graph

## Phase 5: Collaboration and Access Control

- permissions
- collaborative editing
- team and tenant boundaries
