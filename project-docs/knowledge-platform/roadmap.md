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
- graph view now supports group filters, local neighborhood scope, and focused node exploration
- person extraction has been tightened to reduce noisy topical nodes from tags and transcript headings

Next:

1. improve extraction precision for `concept` and `project`
2. add richer relation-aware graph interactions
3. add more pivots around evidence and entity types

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
