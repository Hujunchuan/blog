import { KnowledgeSnapshot } from "./types"

export interface SnapshotRepository {
  get(sourceId: string): Promise<KnowledgeSnapshot | undefined>
  set(sourceId: string, snapshot: KnowledgeSnapshot): Promise<void>
  invalidate(sourceId?: string): Promise<void>
}
