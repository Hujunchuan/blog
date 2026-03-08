import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { FullSlug, resolveRelative } from "../util/path"

interface Options {
  slug: FullSlug
  label: string
  description: string
}

const defaultOptions: Options = {
  slug: "knowledge-xray/index" as FullSlug,
  label: "知识库透视",
  description: "打开知识工程仪表盘",
}

export default ((userOpts?: Partial<Options>) => {
  const opts = { ...defaultOptions, ...userOpts }

  const KnowledgeDashboardLink: QuartzComponent = ({
    fileData,
    displayClass,
  }: QuartzComponentProps) => {
    const href = resolveRelative(fileData.slug!, opts.slug)
    const isActive = fileData.slug === opts.slug

    return (
      <a
        class={classNames(displayClass, "knowledge-dashboard-link", isActive ? "active" : "")}
        href={href}
      >
        <span class="knowledge-dashboard-link__label">{opts.label}</span>
        <span class="knowledge-dashboard-link__description">{opts.description}</span>
      </a>
    )
  }

  KnowledgeDashboardLink.css = `
    .knowledge-dashboard-link {
      display: grid;
      gap: 0.2rem;
      padding: 0.9rem 1rem;
      border: 1px solid color-mix(in srgb, var(--secondary) 16%, transparent);
      border-radius: 16px;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--secondary) 12%, var(--light) 88%),
        color-mix(in srgb, var(--tertiary) 14%, var(--light) 86%)
      );
      text-decoration: none;
      transition:
        transform 0.18s ease,
        border-color 0.18s ease,
        box-shadow 0.18s ease;
      margin: 1rem 0;
    }

    .knowledge-dashboard-link:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--secondary) 34%, transparent);
      box-shadow: 0 16px 36px rgba(17, 24, 39, 0.08);
    }

    .knowledge-dashboard-link.active {
      border-color: var(--secondary);
      box-shadow: 0 16px 36px rgba(17, 24, 39, 0.12);
    }

    .knowledge-dashboard-link__label {
      color: var(--dark);
      font-weight: 700;
      font-size: 0.98rem;
    }

    .knowledge-dashboard-link__description {
      color: var(--darkgray);
      font-size: 0.82rem;
      line-height: 1.45;
    }
  `

  return KnowledgeDashboardLink
}) satisfies QuartzComponentConstructor<Partial<Options>>
