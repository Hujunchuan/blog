import { promises as fs } from "fs"
import path from "path"
import { KnowledgeSource } from "@repo/core/types"

const DEFAULT_SOURCES_FILE = "knowledge-sources.json"

const DEFAULT_SOURCES: KnowledgeSource[] = [
  {
    id: "zizhiguanxing",
    name: "止止观行",
    type: "local",
    location: "C:/Users/god89/Documents/止止观行",
    enabled: true,
    description: "当前默认本地知识源，用于驱动动态平台第一阶段原型。",
    settings: {
      ignorePatterns: [".git", ".obsidian", "node_modules", "public"],
    },
  },
]

function isKnowledgeSource(source: unknown): source is KnowledgeSource {
  if (!source || typeof source !== "object") return false
  const candidate = source as KnowledgeSource
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.location === "string" &&
    typeof candidate.enabled === "boolean"
  )
}

async function readSourcesFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    const sources = parsed.filter(isKnowledgeSource)
    return sources.length > 0 ? sources : undefined
  } catch {
    return undefined
  }
}

export async function getKnowledgeSourcesConfig(): Promise<KnowledgeSource[]> {
  const fromEnv = process.env.KNOWLEDGE_SOURCES_JSON
  if (fromEnv) {
    try {
      const parsed = JSON.parse(fromEnv)
      if (Array.isArray(parsed)) {
        const sources = parsed.filter(isKnowledgeSource)
        if (sources.length > 0) return sources
      }
    } catch {
      // Fall through to file-based config.
    }
  }

  const fileName = process.env.KNOWLEDGE_SOURCES_FILE || DEFAULT_SOURCES_FILE
  const filePath = path.join(process.cwd(), fileName)
  const fileSources = await readSourcesFile(filePath)
  return fileSources ?? DEFAULT_SOURCES
}

export function getSnapshotTtlMs() {
  const raw = process.env.KNOWLEDGE_CACHE_TTL_MS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000
}
