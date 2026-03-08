import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"
import { version } from "../../package.json"
import { i18n } from "../i18n"

interface Options {
  links: Record<string, string>
  showCreatedWith: boolean
}

export default ((opts?: Partial<Options>) => {
  const Footer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const year = new Date().getFullYear()
    const links = Object.entries(opts?.links ?? {})
    const showCreatedWith = opts?.showCreatedWith ?? true

    if (!showCreatedWith && links.length === 0) {
      return null
    }

    return (
      <footer class={`${displayClass ?? ""}`}>
        {showCreatedWith && (
          <p>
            {i18n(cfg.locale).components.footer.createdWith}{" "}
            <a href="https://quartz.jzhao.xyz/">Quartz v{version}</a> © {year}
          </p>
        )}
        {links.length > 0 && (
          <ul>
            {links.map(([text, link]) => (
              <li>
                <a href={link}>{text}</a>
              </li>
            ))}
          </ul>
        )}
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
