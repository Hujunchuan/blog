import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, SimpleSlug, resolveRelative } from "../util/path"
import { getDate } from "./Date"
import style from "./styles/vaultHome.scss"

interface Options {
  title: string
  subtitle: string
  dashboardSlug: FullSlug
  sectionLimit: number
  recentLimit: number
}

const rootSection = "Root"

const defaultOptions: Options = {
  title: "Hu Junchuan Knowledge Base",
  subtitle:
    "This fallback home page is generated automatically when the vault root has no index.md.",
  dashboardSlug: "knowledge-xray/index" as FullSlug,
  sectionLimit: 8,
  recentLimit: 10,
}

type SectionSummary = {
  name: string
  slug: FullSlug | SimpleSlug
  count: number
}

export default ((userOpts?: Partial<Options>) => {
  const opts = { ...defaultOptions, ...userOpts }

  const VaultHome: QuartzComponent = ({ allFiles, fileData, cfg }: QuartzComponentProps) => {
    const notes = allFiles.filter(
      (page) => page.slug && page.slug !== "index" && !page.slug.startsWith("tags/"),
    )

    const sections = new Map<string, SectionSummary>()
    for (const note of notes) {
      const parts = note.slug!.split("/").filter((part) => part.length > 0 && part !== "index")
      const section = parts[0] ?? rootSection
      if (!sections.has(section)) {
        sections.set(section, {
          name: section,
          slug: (section === rootSection ? "/" : `${section}/`) as FullSlug | SimpleSlug,
          count: 0,
        })
      }
      sections.get(section)!.count += 1
    }

    const topSections = [...sections.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"))
      .slice(0, opts.sectionLimit)

    const recentNotes = [...notes]
      .filter((note) => getDate(cfg, note))
      .sort((a, b) => {
        const aTime = getDate(cfg, a)?.getTime() ?? 0
        const bTime = getDate(cfg, b)?.getTime() ?? 0
        return bTime - aTime
      })
      .slice(0, opts.recentLimit)

    return (
      <div class="vault-home">
        <section class="vault-home__hero">
          <p class="vault-home__eyebrow">Knowledge Base</p>
          <h1>{opts.title}</h1>
          <p class="vault-home__subtitle">{opts.subtitle}</p>
          <div class="vault-home__actions">
            <a
              class="vault-home__primary"
              href={resolveRelative(fileData.slug!, opts.dashboardSlug)}
            >
              Open Knowledge Xray
            </a>
            <a class="vault-home__secondary" href="#vault-home-sections">
              Browse Sections
            </a>
          </div>
        </section>

        <section class="vault-home__stats">
          <article>
            <span>Notes</span>
            <strong>{notes.length}</strong>
          </article>
          <article>
            <span>Top-level Sections</span>
            <strong>{sections.size}</strong>
          </article>
          <article>
            <span>Tag Pages</span>
            <strong>{allFiles.filter((page) => page.slug?.startsWith("tags/")).length}</strong>
          </article>
        </section>

        <section class="vault-home__panel" id="vault-home-sections">
          <div class="vault-home__panel-header">
            <div>
              <h2>Sections</h2>
              <p>Jump into the main areas of the vault.</p>
            </div>
          </div>
          <div class="vault-home__section-grid">
            {topSections.map((section) => (
              <a
                class="vault-home__section-card"
                href={resolveRelative(fileData.slug!, section.slug)}
              >
                <strong>{section.name}</strong>
                <span>{section.count} notes</span>
              </a>
            ))}
          </div>
        </section>

        <section class="vault-home__panel">
          <div class="vault-home__panel-header">
            <div>
              <h2>Recent Updates</h2>
              <p>Pages with the newest detected timestamps.</p>
            </div>
          </div>
          <ul class="vault-home__recent-list">
            {recentNotes.map((note) => (
              <li>
                <a href={resolveRelative(fileData.slug!, note.slug!)}>
                  <strong>{note.frontmatter?.title ?? note.slug}</strong>
                  <span>{note.slug}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  VaultHome.css = style
  return VaultHome
}) satisfies QuartzComponentConstructor<Partial<Options>>
