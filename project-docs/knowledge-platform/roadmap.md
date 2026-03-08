# Roadmap

## Phase 1: Dynamic Site Baseline

Scope:

- Local directory connector
- Next.js application shell
- Explorer
- Search
- Document page
- Simplified graph

Status:

- Completed and running

## Phase 2: Persistence and Operational Baseline

Scope:

- PostgreSQL integration
- Snapshot persistence
- Sync run tracking
- Database-first read path
- Admin console
- Local watcher

Status:

- `sources`, `documents`, and `sync_runs` are in place
- Manual and watcher-triggered persistence are available
- Overview, search, document page, Explorer, and graph can read from PostgreSQL first
- `/admin` is available

Next:

1. Improve persisted projections for graph and Explorer.
2. Move watcher behavior toward incremental sync.
3. Prepare the GitHub connector baseline.

## Phase 2.5: Nervous System Baseline

Scope:

- Nervous-system schema
- Minimal extraction rules
- `related`, `impact`, and `evidence` APIs
- First frontend entry and analysis screen

Status:

- `entities` and `relations` are persisted
- First extraction rules use `documents.tags` and internal document links
- `related`, `impact`, and `evidence` APIs are available
- `/source/[sourceId]/knowledge` is live
- Source and document pages now link into the analysis workflow

Next:

1. Add knowledge-node mode into the graph UI.
2. Expand extraction rules for `concept`, `person`, and `project`.
3. Add more frontend pivots and local graph exploration.

## Phase 3: Multi-Source Federation

Scope:

- GitHub connector
- Remote server connector
- Incremental sync
- Cross-source search

## Phase 4: Intelligence Layer

Scope:

- AI summaries
- Semantic search
- richer relation extraction
- federated knowledge graph

## Phase 5: Collaboration and Access Control

Scope:

- Permissions
- Collaborative editing
- team and tenant boundaries
