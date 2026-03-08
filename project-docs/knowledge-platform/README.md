# Knowledge Platform Docs Index

This document set describes the migration path from the original Quartz-based static knowledge site to a dynamic knowledge platform with database persistence, multi-source ingestion, and a nervous-system layer.

## Current Platform Status

- `apps/web` is the active dynamic site built with Next.js.
- Local knowledge sources are configured in `apps/web/knowledge-sources.json`.
- The platform already includes a local connector, markdown parser, snapshot builder, and in-memory snapshot cache.
- PostgreSQL support is in place for `sources`, `documents`, `sync_runs`, `entities`, and `relations`.
- Overview, search, document page, Explorer, graph, and nervous-system APIs already read from PostgreSQL first and fall back to snapshots when needed.
- `/admin` is available for health checks and manual sync actions.
- `npm run watch:sources` can watch local sources and trigger automatic persistence.
- The first nervous-system analysis screen is available at `/source/[sourceId]/knowledge`.
- The graph page now supports both document mode and knowledge mode at `/source/[sourceId]/graph`.

## Document List

- `architecture.md`: system architecture, boundaries, and read/write flow.
- `data-model.md`: database entities, indexes, and model rules.
- `api-spec.md`: API contracts and current endpoint behavior.
- `connectors.md`: source connector contracts and extension rules.
- `parser-spec.md`: markdown and metadata parsing rules.
- `sync-pipeline.md`: ingestion, parsing, persistence, and fallback flow.
- `nervous-system-plan.md`: phased plan for the knowledge nervous-system upgrade.
- `deployment.md`: local development and deployment notes.
- `operations.md`: troubleshooting and operational guidance.
- `roadmap.md`: delivery phases and current progress.
- `adr/`: architecture decision records.

## Current Implementation Layout

1. `apps/web`
   Dynamic frontend and HTTP API.
2. `packages/core`
   Shared types and contracts.
3. `packages/connectors`
   Knowledge source connectors.
4. `packages/parser`
   Markdown parser implementation.
5. `packages/sync`
   Snapshot, projection, sync, and nervous-system builders.
6. `packages/db`
   PostgreSQL schema, queries, and persistence logic.

## Recent Milestone

- Added `/source/[sourceId]/knowledge` as the first nervous-system analysis page.
- Added source-page entry links into the analysis workflow.
- Added document-page entry links and tag pivots into the same workflow.
- Combined `related`, `impact`, and `evidence` data into one screen.
- Added `/source/[sourceId]/graph` with `documents` and `knowledge` modes.

## Next Focus

1. Expand entity extraction beyond tags and document links.
2. Add richer graph interactions on top of the new dual-mode graph page.
3. Add GitHub connector as the first remote source connector.
4. Move watcher-driven sync from full refresh toward incremental sync.
