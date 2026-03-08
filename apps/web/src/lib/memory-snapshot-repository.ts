import { SnapshotRepository } from "@repo/core/repositories"
import { KnowledgeSnapshot } from "@repo/core/types"

type CacheEntry = {
  snapshot: KnowledgeSnapshot
  createdAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __knowledgeSnapshotCache__: Map<string, CacheEntry> | undefined
}

const cache = globalThis.__knowledgeSnapshotCache__ ?? new Map<string, CacheEntry>()
globalThis.__knowledgeSnapshotCache__ = cache

export class MemorySnapshotRepository implements SnapshotRepository {
  constructor(private readonly ttlMs: number) {}

  async get(sourceId: string): Promise<KnowledgeSnapshot | undefined> {
    const entry = cache.get(sourceId)
    if (!entry) return undefined
    if (Date.now() - entry.createdAt >= this.ttlMs) {
      cache.delete(sourceId)
      return undefined
    }

    return entry.snapshot
  }

  async set(sourceId: string, snapshot: KnowledgeSnapshot): Promise<void> {
    cache.set(sourceId, {
      snapshot,
      createdAt: Date.now(),
    })
  }

  async invalidate(sourceId?: string): Promise<void> {
    if (sourceId) {
      cache.delete(sourceId)
      return
    }

    cache.clear()
  }
}
