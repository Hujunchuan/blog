# Nervous System Upgrade Plan

## Background

The current platform already supports:

- multi-source ingestion scaffolding
- document persistence
- Explorer
- search
- a simplified graph based on document links

That is enough for a knowledge site, but not enough for a knowledge-engineering workflow. The current graph can mostly answer:

- which document links to which document
- which folder contains which documents

It cannot yet answer higher-level questions such as:

- which concepts are connected to which meetings, projects, and tasks
- which evidence chain supports a decision
- which downstream nodes may be affected when one knowledge node changes

The goal of this upgrade is to adopt the GitNexus-style nervous-system idea without copying its codebase model directly.

## Goals

1. Add an entity layer and relation layer on top of documents.
2. Upgrade the graph from a document-link graph to a knowledge-structure graph.
3. Provide a stable indexing layer for future AI search, impact analysis, and multi-source federation.

## Non-Goals

This phase does not try to:

- replace the whole Explorer, Search, or Graph read path at once
- introduce a dedicated graph database
- ship the full agent or MCP tool layer
- solve every extraction rule in one pass

## Key Changes

### 1. Data Model

Add:

- `entities`
- `relations`

These are the minimum persistent tables required for the nervous-system layer.

### 2. Extraction Flow

The sync pipeline should gradually move from pure document parsing to structured extraction:

- entity recognition
- relation recognition
- rule-based and later model-assisted structuring

### 3. Query Layer

The nervous-system APIs should support:

- related nodes
- impact analysis
- evidence lookup
- later process tracing and cluster context

### 4. UI Layer

The UI should evolve from a plain document graph toward a typed knowledge view with:

- node-type pivots
- relation-type pivots
- evidence drill-down
- local impact exploration

## Phased Rollout

### Phase A: Baseline Model

- Define `KnowledgeEntity` and `KnowledgeRelation`.
- Add `entities` and `relations` to PostgreSQL.
- Keep the existing site read paths stable.

### Phase B: Minimal Extractor

Start with:

- `documents.tags`
- explicit internal document links
- title and path heuristics where useful

Initial entity types:

- `document`
- `tag`
- `concept`
- `person`
- `project`
- `meeting`

Initial relation types:

- `mentions`
- `references`
- `belongs_to`
- `related_to`

### Phase C: Query APIs

Add:

- `GET /api/source/[sourceId]/related`
- `GET /api/source/[sourceId]/impact`
- `GET /api/source/[sourceId]/evidence`

### Phase D: Nervous System UI

Add a dedicated frontend surface that can:

- pivot from documents or tags
- show related nodes
- show multi-hop impact
- show evidence documents

### Phase E: Agent and Tooling Layer

Prepare future tool interfaces such as:

- `search_knowledge`
- `find_related_nodes`
- `analyze_impact`
- `trace_process`

## Current Scope Already Landed

- nervous-system schema is in place
- `entities / relations` persistence is in place
- first extraction rules are in place
- typed extraction now derives `concept`, `person`, and `project` from tags, titles, paths, and transcript speakers
- person extraction now uses stricter tag rules and separate speaker rules to suppress generic topical labels
- `related`, `impact`, and `evidence` APIs are in place
- `/source/[sourceId]/knowledge` is the first integrated analysis screen
- source and document pages now link into this workflow
- `/source/[sourceId]/graph` now exposes the first dual-mode graph surface

## Next Priorities

1. Improve precision for `concept` and `project` extraction.
2. Add richer graph interactions and better local exploration around focused nodes.
3. Add more frontend pivots around entity types and evidence links.
4. Keep the nervous-system layer compatible with future GitHub and remote-server connectors.
