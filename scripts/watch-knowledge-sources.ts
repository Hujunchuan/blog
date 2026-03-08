import { promises as fs } from "fs"
import path from "path"
import chokidar from "chokidar"
import { createKnowledgeConnector } from "../packages/connectors/src/factory"
import { KnowledgeSource } from "../packages/core/src/types"
import { initializeDatabaseSchema, isDatabaseConfigured, persistSourceSnapshot } from "../packages/db/src"
import { MarkdownKnowledgeParser } from "../packages/parser/src/markdownParser"
import { buildKnowledgeSnapshot } from "../packages/sync/src/syncKnowledgeBase"

const DEFAULT_IGNORES = new Set([".git", ".obsidian", ".next", "node_modules", "public", "dist", "build"])
const DEFAULT_SOURCES_FILE = path.join("apps", "web", "knowledge-sources.json")
const DEFAULT_ENV_FILE = path.join("apps", "web", ".env.local")
const DEBOUNCE_MS = 1500

function parseEnv(contents: string) {
  const entries = contents.split(/\r?\n/g)
  for (const line of entries) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separator = trimmed.indexOf("=")
    if (separator <= 0) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

async function loadEnvFile(envPath: string) {
  try {
    const contents = await fs.readFile(envPath, "utf8")
    parseEnv(contents)
  } catch {
    // Ignore missing env files and rely on process environment.
  }
}

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

async function loadSourcesConfig() {
  const configured = process.env.KNOWLEDGE_SOURCES_FILE
  let filePath = path.join(process.cwd(), DEFAULT_SOURCES_FILE)

  if (configured) {
    if (path.isAbsolute(configured)) {
      filePath = configured
    } else {
      const rootRelative = path.join(process.cwd(), configured)
      const appRelative = path.join(process.cwd(), "apps", "web", configured)

      try {
        await fs.access(rootRelative)
        filePath = rootRelative
      } catch {
        filePath = appRelative
      }
    }
  }

  const raw = await fs.readFile(filePath, "utf8")
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid sources config at ${filePath}`)
  }

  return parsed.filter(isKnowledgeSource).filter((source) => source.enabled)
}

async function syncSource(source: KnowledgeSource) {
  const connector = createKnowledgeConnector(source)
  const parser = new MarkdownKnowledgeParser()
  const startedAt = Date.now()
  const snapshot = await buildKnowledgeSnapshot(source, connector, parser)
  const result = await persistSourceSnapshot(source, snapshot)
  const elapsedMs = Date.now() - startedAt
  console.log(
    `[sync] ${source.id} persisted ${result.documentCount} documents in ${elapsedMs}ms (run ${result.syncRunId})`,
  )
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), DEFAULT_ENV_FILE))

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured. Configure apps/web/.env.local before starting the watcher.")
  }

  await initializeDatabaseSchema()
  const sources = await loadSourcesConfig()
  const localSources = sources.filter((source) => source.type === "local")

  if (localSources.length === 0) {
    console.log("[watch] No local sources enabled. Nothing to watch.")
    return
  }

  const timers = new Map<string, NodeJS.Timeout>()
  const running = new Set<string>()
  const rerun = new Set<string>()

  const scheduleSync = (source: KnowledgeSource, reason: string) => {
    const existing = timers.get(source.id)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      timers.delete(source.id)

      if (running.has(source.id)) {
        rerun.add(source.id)
        return
      }

      running.add(source.id)
      try {
        console.log(`[watch] syncing ${source.id} because ${reason}`)
        await syncSource(source)
      } catch (error) {
        console.error(`[watch] sync failed for ${source.id}:`, error)
      } finally {
        running.delete(source.id)
        if (rerun.has(source.id)) {
          rerun.delete(source.id)
          scheduleSync(source, "queued change")
        }
      }
    }, DEBOUNCE_MS)

    timers.set(source.id, timer)
  }

  for (const source of localSources) {
    await syncSource(source)
  }

  const watchers = localSources.map((source) => {
    const ignoredNames = new Set([
      ...DEFAULT_IGNORES,
      ...(source.settings?.ignorePatterns ?? []).filter(
        (pattern) => !pattern.includes("/") && !pattern.includes("*") && !pattern.includes("\\"),
      ),
    ])

    const watcher = chokidar.watch(source.location, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 800,
        pollInterval: 100,
      },
      ignored(targetPath, stats) {
        const normalized = targetPath.replace(/\\/g, "/")
        const relative = normalized.startsWith(source.location.replace(/\\/g, "/"))
          ? normalized.slice(source.location.replace(/\\/g, "/").length)
          : normalized
        const segments = relative.split("/").filter(Boolean)
        const lastSegment = segments.at(-1)

        if (segments.some((segment) => ignoredNames.has(segment))) return true
        if (segments.some((segment) => segment.startsWith("."))) return true
        if (stats?.isFile() && lastSegment && !lastSegment.endsWith(".md") && !lastSegment.endsWith(".mdx")) return true
        return false
      },
    })

    watcher.on("all", (event, changedPath) => {
      const relative = path.relative(source.location, changedPath).replace(/\\/g, "/")
      console.log(`[watch] ${source.id} detected ${event}: ${relative}`)
      scheduleSync(source, `${event} ${relative}`)
    })

    return watcher
  })

  const shutdown = async () => {
    console.log("[watch] shutting down watchers...")
    await Promise.all(watchers.map((watcher) => watcher.close()))
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  console.log(`[watch] watching ${localSources.length} source(s) for automatic PostgreSQL sync`)
}

main().catch((error) => {
  console.error("[watch] fatal error:", error)
  process.exit(1)
})
