import { promises as fs } from "fs"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"
import { KnowledgeConnector, KnowledgeSource, SourceDocument } from "../../core/src"
import { scanMarkdownDirectory } from "./filesystemWalker"

const execFileAsync = promisify(execFile)
const MIRROR_TTL_MS = 60_000
const mirrorSyncState = new Map<string, { lastSyncedAt: number; inFlight?: Promise<string> }>()

type ParsedGitHubRepo = {
  owner: string
  repo: string
}

function parseGitHubLocation(location: string): ParsedGitHubRepo {
  const trimmed = location.trim()
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  const shortMatch = trimmed.match(/^([^/]+)\/([^/]+)$/)
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/i, "") }
  }

  throw new Error(`Unsupported GitHub source location: ${location}`)
}

function buildRemoteUrl(source: KnowledgeSource) {
  const repo = parseGitHubLocation(source.location)
  const tokenEnv = source.settings?.github?.tokenEnv
  const token = tokenEnv ? process.env[tokenEnv] : undefined

  if (tokenEnv && !token) {
    throw new Error(`GitHub token environment variable is not set: ${tokenEnv}`)
  }

  if (token) {
    return `https://x-access-token:${encodeURIComponent(token)}@github.com/${repo.owner}/${repo.repo}.git`
  }

  return `https://github.com/${repo.owner}/${repo.repo}.git`
}

function resolveMirrorDirectory(source: KnowledgeSource) {
  const configured = source.settings?.github?.cacheDir
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
  }

  return path.join(process.cwd(), ".cache", "github-sources", source.id)
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function runGit(args: string[], cwd?: string) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
    })

    return stdout
  } catch (error) {
    const detail =
      error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : error instanceof Error
          ? error.message
          : String(error)

    throw new Error(`git ${args.join(" ")} failed: ${detail}`)
  }
}

async function syncMirror(source: KnowledgeSource) {
  const mirrorDir = resolveMirrorDirectory(source)
  const branch = source.settings?.github?.branch
  const remoteUrl = buildRemoteUrl(source)
  const parentDir = path.dirname(mirrorDir)
  await fs.mkdir(parentDir, { recursive: true })

  const hasRepo = await pathExists(path.join(mirrorDir, ".git"))
  if (!hasRepo) {
    const cloneArgs = ["clone", "--depth", "1"]
    if (branch) {
      cloneArgs.push("--branch", branch)
    }
    cloneArgs.push(remoteUrl, mirrorDir)
    await runGit(cloneArgs)
    return mirrorDir
  }

  await runGit(["-C", mirrorDir, "remote", "set-url", "origin", remoteUrl])

  if (branch) {
    await runGit(["-C", mirrorDir, "fetch", "--depth", "1", "origin", branch])
    await runGit(["-C", mirrorDir, "checkout", "-B", branch, "FETCH_HEAD"])
    return mirrorDir
  }

  await runGit(["-C", mirrorDir, "pull", "--ff-only"])
  return mirrorDir
}

async function ensureMirror(source: KnowledgeSource) {
  const mirrorDir = resolveMirrorDirectory(source)
  const state = mirrorSyncState.get(mirrorDir)
  const now = Date.now()

  if (state?.inFlight) {
    return state.inFlight
  }

  if (state && now - state.lastSyncedAt < MIRROR_TTL_MS && (await pathExists(path.join(mirrorDir, ".git")))) {
    return mirrorDir
  }

  const inFlight = syncMirror(source)
    .then((result) => {
      mirrorSyncState.set(mirrorDir, {
        lastSyncedAt: Date.now(),
        inFlight: undefined,
      })
      return result
    })
    .catch((error) => {
      mirrorSyncState.set(mirrorDir, {
        lastSyncedAt: state?.lastSyncedAt ?? 0,
        inFlight: undefined,
      })
      throw error
    })

  mirrorSyncState.set(mirrorDir, {
    lastSyncedAt: state?.lastSyncedAt ?? 0,
    inFlight,
  })

  return inFlight
}

export class GitHubConnector implements KnowledgeConnector {
  constructor(private readonly source: KnowledgeSource) {}

  async getSource(): Promise<KnowledgeSource> {
    return this.source
  }

  async listDocuments(): Promise<SourceDocument[]> {
    const mirrorDir = await ensureMirror(this.source)
    return scanMarkdownDirectory(mirrorDir, {
      ignorePatterns: [...(this.source.settings?.ignorePatterns ?? []), ".github"],
    })
  }

  async readDocument(relativePath: string): Promise<string> {
    const mirrorDir = await ensureMirror(this.source)
    const target = path.join(mirrorDir, relativePath)
    return fs.readFile(target, "utf8")
  }
}
