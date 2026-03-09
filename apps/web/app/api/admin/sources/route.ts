import { NextResponse } from "next/server"
import { KnowledgeSource } from "@repo/core/types"
import { appendKnowledgeSource, getKnowledgeSourcesConfig } from "@/lib/config"

type CreateGitHubSourceInput = {
  type?: string
  name?: string
  location?: string
  branch?: string
  description?: string
  tokenEnv?: string
}

function normalizeSourceId(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "github-source"
}

function buildSourceId(input: CreateGitHubSourceInput, existingIds: Set<string>) {
  const seed = input.location?.split("/").filter(Boolean).slice(-1)[0] || input.name || "github-source"
  const base = normalizeSourceId(seed)
  let candidate = base
  let counter = 2

  while (existingIds.has(candidate)) {
    candidate = `${base}-${counter}`
    counter += 1
  }

  return candidate
}

function normalizeGitHubLocation(value: string) {
  const trimmed = value.trim()
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git|\/)?$/i)
  if (httpsMatch) {
    return httpsMatch[1]
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i)
  if (sshMatch) {
    return sshMatch[1]
  }

  return trimmed.replace(/\.git$/i, "").replace(/\/+$/, "")
}

function isValidOwnerRepo(value: string) {
  return /^[^/\s]+\/[^/\s]+$/.test(value)
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateGitHubSourceInput

    if (input.type !== "github") {
      return NextResponse.json(
        {
          status: "invalid_type",
          message: "Only GitHub sources can be created from the admin console",
        },
        { status: 400 },
      )
    }

    const name = input.name?.trim()
    const location = normalizeGitHubLocation(input.location ?? "")
    const branch = input.branch?.trim()
    const description = input.description?.trim()
    const tokenEnv = input.tokenEnv?.trim()

    if (!name || !location) {
      return NextResponse.json(
        {
          status: "invalid_input",
          message: "Name and GitHub repository are required",
        },
        { status: 400 },
      )
    }

    if (!isValidOwnerRepo(location)) {
      return NextResponse.json(
        {
          status: "invalid_location",
          message: "GitHub repository must use owner/repo, https://github.com/owner/repo, or git@github.com:owner/repo.git",
        },
        { status: 400 },
      )
    }

    const currentSources = await getKnowledgeSourcesConfig()
    const normalizedLocations = new Set(
      currentSources
        .filter((source) => source.type === "github")
        .map((source) => normalizeGitHubLocation(source.location)),
    )

    if (normalizedLocations.has(location)) {
      return NextResponse.json(
        {
          status: "duplicate",
          message: `GitHub source already exists: ${location}`,
        },
        { status: 409 },
      )
    }

    const sourceId = buildSourceId(input, new Set(currentSources.map((source) => source.id)))
    const source: KnowledgeSource = {
      id: sourceId,
      name,
      type: "github",
      location,
      enabled: true,
      description: description || "GitHub 知识源",
      settings: {
        ignorePatterns: [".github"],
        github: {
          ...(branch ? { branch } : {}),
          ...(tokenEnv ? { tokenEnv } : {}),
          cacheDir: `.cache/github-sources/${sourceId}`,
        },
      },
    }

    await appendKnowledgeSource(source)

    return NextResponse.json({
      status: "ok",
      message: "GitHub source added",
      source,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source creation error"
    const status = message.includes("admin writes are disabled") ? 400 : 500

    return NextResponse.json(
      {
        status: status === 400 ? "read_only" : "error",
        message,
      },
      { status },
    )
  }
}
