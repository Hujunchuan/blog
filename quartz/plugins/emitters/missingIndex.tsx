import { FullPageLayout } from "../../cfg"
import * as Component from "../../components"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { QuartzComponentProps } from "../../components/types"
import { defaultListPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { BuildCtx } from "../../util/ctx"
import { FilePath, FullSlug, pathToRoot } from "../../util/path"
import { StaticResources } from "../../util/resources"
import { QuartzEmitterPlugin } from "../types"
import { defaultProcessedContent, ProcessedContent } from "../vfile"
import { write } from "./helpers"

interface Options {
  title: string
  subtitle: string
  slug: FullSlug
}

const defaultOptions: Options = {
  title: "胡峻川的个人知识库系统",
  subtitle: "这是 Quartz 为缺失 index.md 的知识库自动生成的首页。",
  slug: "index" as FullSlug,
}

async function emitMissingIndexPage(
  ctx: BuildCtx,
  content: ProcessedContent[],
  resources: StaticResources,
  opts: Options,
  layout: FullPageLayout,
) {
  const hasIndex = content.some(([, file]) => file.data.slug === "index")
  if (hasIndex) {
    return null
  }

  const cfg = ctx.cfg.configuration
  const allFiles = content.map((item) => item[1].data)
  const page = defaultProcessedContent({
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

  const [tree, file] = page
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

  return write({
    ctx,
    slug: opts.slug,
    ext: ".html",
    content: renderPage(cfg, opts.slug, componentData, layout, externalResources),
  })
}

export const MissingIndexPage: QuartzEmitterPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  const layout: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    beforeBody: [],
    pageBody: Component.VaultHome({
      title: opts.title,
      subtitle: opts.subtitle,
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
    name: "MissingIndexPage",
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
      const result = await emitMissingIndexPage(ctx, content, resources, opts, layout)
      if (result) {
        yield result
      }
    },
    async *partialEmit(ctx, content, resources) {
      const result = await emitMissingIndexPage(ctx, content, resources, opts, layout)
      if (result) {
        yield result
      }
    },
  }
}
