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
    description: "当前默认本地知识源，用于驱动动态知识平台。",
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

function parseKnowledgeSources(raw: string) {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    return undefined
  }

  const sources = parsed.filter(isKnowledgeSource)
  return sources.length > 0 ? sources : undefined
}

export function resolveKnowledgeSourcesFilePath() {
  const fileName = process.env.KNOWLEDGE_SOURCES_FILE || DEFAULT_SOURCES_FILE
  return path.join(process.cwd(), fileName)
}

export async function readKnowledgeSourcesFromFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return parseKnowledgeSources(raw)
  } catch {
    return undefined
  }
}

export async function getKnowledgeSourcesConfig(): Promise<KnowledgeSource[]> {
  const fromEnv = process.env.KNOWLEDGE_SOURCES_JSON
  if (fromEnv) {
    try {
      const sources = parseKnowledgeSources(fromEnv)
      if (sources) {
        return sources
      }
    } catch {
      // Fall through to file-based config.
    }
  }

  const fileSources = await readKnowledgeSourcesFromFile(resolveKnowledgeSourcesFilePath())
  return fileSources ?? DEFAULT_SOURCES
}

export async function writeKnowledgeSourcesConfig(sources: KnowledgeSource[]) {
  if (process.env.KNOWLEDGE_SOURCES_JSON) {
    throw new Error("KNOWLEDGE_SOURCES_JSON is set; admin writes are disabled")
  }

  const filePath = resolveKnowledgeSourcesFilePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(sources, null, 2)}\n`, "utf8")
}

export async function appendKnowledgeSource(source: KnowledgeSource) {
  const current = await getKnowledgeSourcesConfig()
  await writeKnowledgeSourcesConfig([...current, source])
}

export function getSnapshotTtlMs() {
  const raw = process.env.KNOWLEDGE_CACHE_TTL_MS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000
}
