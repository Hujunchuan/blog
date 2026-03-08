import { FullPageLayout } from "../../cfg"
import * as Component from "../../components"
import { getDate } from "../../components/Date"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { QuartzComponentProps } from "../../components/types"
import { defaultListPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { BuildCtx } from "../../util/ctx"
import { FilePath, FullSlug, SimpleSlug, pathToRoot, simplifySlug } from "../../util/path"
import { StaticResources } from "../../util/resources"
import { write } from "./helpers"
import { QuartzEmitterPlugin } from "../types"
import { ProcessedContent, defaultProcessedContent } from "../vfile"

type DashboardNote = {
  slug: FullSlug
  title: string
  folder: string
  section: string
  tags: string[]
  contentSize: number
  outgoing: number
  incoming: number
  linkScore: number
  date?: string
}

type DashboardLink = {
  source: FullSlug
  target: FullSlug
}

interface Options {
  slug: FullSlug
  title: string
  subtitle: string
  graphLimit: number
  dataSlug: FullSlug
}

const defaultOptions: Options = {
  slug: "knowledge-xray/index" as FullSlug,
  title: "知识库透视",
  subtitle:
    "参考 code-xray 的分析思路，为 Quartz 知识库生成目录 treemap、知识图谱、更新时间热力图和主题标签分布。",
  graphLimit: 120,
  dataSlug: "static/knowledge-dashboard" as FullSlug,
}

function getContentSize(text?: string) {
  return (text ?? "").replace(/\s+/g, "").length
}

function getFolderLabel(slug: FullSlug) {
  const parts = simplifySlug(slug)
    .split("/")
    .filter((part) => part.length > 0 && part !== "/")
  if (parts.length <= 1) return "根目录"
  return parts.slice(0, -1).join("/")
}

function getSectionLabel(folder: string) {
  if (folder === "根目录") return folder
  return folder.split("/")[0] ?? "根目录"
}

function countRecentActiveDays(notes: DashboardNote[]) {
  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - 29)

  const unique = new Set<string>()
  for (const note of notes) {
    if (!note.date) continue
    const date = new Date(note.date)
    if (date >= threshold) {
      unique.add(note.date.slice(0, 10))
    }
  }

  return unique.size
}

function buildDashboardData(ctx: BuildCtx, content: ProcessedContent[]) {
  const fullBySimple = new Map<SimpleSlug, FullSlug>()
  for (const [, file] of content) {
    const slug = file.data.slug!
    fullBySimple.set(simplifySlug(slug), slug)
  }

  const incomingCounts = new Map<FullSlug, number>()
  const linkSet = new Set<string>()
  const links: DashboardLink[] = []

  for (const [, file] of content) {
    const source = file.data.slug!
    const outgoing = new Set(file.data.links ?? [])
    for (const simpleTarget of outgoing) {
      const target = fullBySimple.get(simpleTarget)
      if (!target || target === source) continue

      const key = `${source}->${target}`
      if (linkSet.has(key)) continue

      linkSet.add(key)
      links.push({ source, target })
      incomingCounts.set(target, (incomingCounts.get(target) ?? 0) + 1)
    }
  }

  const tagCounts = new Map<string, number>()
  const notes: DashboardNote[] = content.map(([, file]) => {
    const slug = file.data.slug!
    const tags = (file.data.frontmatter?.tags ?? []) as string[]
    tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1))

    const outgoing = links.filter((link) => link.source === slug).length
    const incoming = incomingCounts.get(slug) ?? 0
    const title =
      file.data.frontmatter?.title ?? (simplifySlug(slug) === "/" ? "首页" : simplifySlug(slug))
    const date = getDate(ctx.cfg.configuration, file.data)
    const folder = getFolderLabel(slug)

    return {
      slug,
      title,
      folder,
      section: getSectionLabel(folder),
      tags,
      contentSize: getContentSize(file.data.text),
      outgoing,
      incoming,
      linkScore: outgoing + incoming,
      date: date?.toISOString(),
    }
  })

  const folders = new Set(notes.map((note) => note.folder))
  const densest = [...notes].sort(
    (a, b) => b.linkScore - a.linkScore || b.contentSize - a.contentSize,
  )[0]
  const freshest = [...notes]
    .filter((note) => !!note.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())[0]

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      notes: notes.length,
      links: links.length,
      folders: folders.size,
      tags: tagCounts.size,
      avgContentSize:
        notes.length > 0
          ? Math.round(notes.reduce((total, note) => total + note.contentSize, 0) / notes.length)
          : 0,
      orphans: notes.filter((note) => note.linkScore === 0).length,
      activeDays: countRecentActiveDays(notes),
      densestNote: densest ? { slug: densest.slug, title: densest.title } : undefined,
      freshestNote: freshest ? { slug: freshest.slug, title: freshest.title } : undefined,
    },
    notes: notes.sort((a, b) => b.linkScore - a.linkScore || b.contentSize - a.contentSize),
    links,
    tags: [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
  }
}

async function* emitDashboardFiles(
  ctx: BuildCtx,
  content: ProcessedContent[],
  resources: StaticResources,
  opts: Options,
  layout: FullPageLayout,
) {
  const cfg = ctx.cfg.configuration
  const allFiles = content.map((item) => item[1].data)
  const dashboardData = buildDashboardData(ctx, content)

  const dashboardPage = defaultProcessedContent({
    slug: opts.slug,
    filePath: `${opts.slug}.md` as FilePath,
    relativePath: `${opts.slug}.md` as FilePath,
    frontmatter: {
      title: opts.title,
      tags: [],
    },
    text: opts.subtitle,
    description: opts.subtitle,
  })

  const [tree, file] = dashboardPage
  const externalResources = pageResources(pathToRoot(opts.slug), resources)
  const componentData: QuartzComponentProps = {
    ctx,
    fileData: file.data,
    externalResources,
    cfg,
    children: [],
    tree,
    allFiles,
  }

  yield write({
    ctx,
    slug: opts.slug,
    ext: ".html",
    content: renderPage(cfg, opts.slug, componentData, layout, externalResources),
  })

  yield write({
    ctx,
    slug: opts.dataSlug,
    ext: ".json",
    content: JSON.stringify(dashboardData),
  })
}

export const KnowledgeDashboard: QuartzEmitterPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  const layout: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    beforeBody: [Component.Breadcrumbs()],
    pageBody: Component.KnowledgeDashboard({
      title: opts.title,
      subtitle: opts.subtitle,
      graphLimit: opts.graphLimit,
    }),
    right: [],
    afterBody: [],
  }

  const {
    head: Head,
    header,
    beforeBody,
    pageBody,
    afterBody,
    left,
    right,
    footer: Footer,
  } = layout
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "KnowledgeDashboard",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async *emit(ctx, content, resources) {
      yield* emitDashboardFiles(ctx, content, resources, opts, layout)
    },
    async *partialEmit(ctx, content, resources) {
      yield* emitDashboardFiles(ctx, content, resources, opts, layout)
    },
  }
}
