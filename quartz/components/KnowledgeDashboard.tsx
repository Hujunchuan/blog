import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { joinSegments, pathToRoot } from "../util/path"
import style from "./styles/knowledgeDashboard.scss"
// @ts-ignore
import script from "./scripts/knowledge-dashboard.inline"

interface Options {
  title: string
  subtitle: string
  graphLimit: number
}

const defaultOptions: Options = {
  title: "知识库透视",
  subtitle:
    "用目录结构、链接关系、标签分布和更新时间，把你的 Quartz 知识库变成可分析的知识工程面板。",
  graphLimit: 120,
}

export default ((userOpts?: Partial<Options>) => {
  const opts = { ...defaultOptions, ...userOpts }

  const KnowledgeDashboard: QuartzComponent = ({
    fileData,
    displayClass,
  }: QuartzComponentProps) => {
    const dataSource = joinSegments(pathToRoot(fileData.slug!), "static/knowledge-dashboard.json")

    return (
      <section
        class={classNames(displayClass, "knowledge-dashboard")}
        data-source={dataSource}
        data-graph-limit={String(opts.graphLimit)}
      >
        <div class="knowledge-dashboard__hero">
          <div>
            <p class="knowledge-dashboard__eyebrow">Knowledge Engineering</p>
            <h1>{opts.title}</h1>
            <p class="knowledge-dashboard__subtitle">{opts.subtitle}</p>
          </div>
          <div class="knowledge-dashboard__meta">
            <span>数据生成时间</span>
            <strong data-generated-at>--</strong>
          </div>
        </div>

        <div class="knowledge-dashboard__stats">
          <article class="knowledge-stat-card">
            <span>笔记总数</span>
            <strong data-stat="notes">0</strong>
          </article>
          <article class="knowledge-stat-card">
            <span>知识链接</span>
            <strong data-stat="links">0</strong>
          </article>
          <article class="knowledge-stat-card">
            <span>目录节点</span>
            <strong data-stat="folders">0</strong>
          </article>
          <article class="knowledge-stat-card">
            <span>标签总数</span>
            <strong data-stat="tags">0</strong>
          </article>
          <article class="knowledge-stat-card">
            <span>平均内容量</span>
            <strong data-stat="avgContentSize">0</strong>
          </article>
          <article class="knowledge-stat-card">
            <span>孤立笔记</span>
            <strong data-stat="orphans">0</strong>
          </article>
        </div>

        <div class="knowledge-dashboard__highlights">
          <article>
            <span>连接最强节点</span>
            <a href="." data-highlight-link="densest">
              --
            </a>
          </article>
          <article>
            <span>最近更新笔记</span>
            <a href="." data-highlight-link="freshest">
              --
            </a>
          </article>
          <article>
            <span>最近 30 天活跃天数</span>
            <strong data-stat="activeDays">0</strong>
          </article>
        </div>

        <div class="knowledge-dashboard__grid">
          <section class="knowledge-panel">
            <div class="knowledge-panel__header">
              <div>
                <h2>目录 Treemap</h2>
                <p>按目录层级与内容量观察知识分布。</p>
              </div>
            </div>
            <div class="knowledge-panel__body" data-chart="treemap"></div>
          </section>

          <section class="knowledge-panel">
            <div class="knowledge-panel__header">
              <div>
                <h2>知识链接图</h2>
                <p>聚焦高连接度节点，定位知识中枢与孤岛。</p>
              </div>
            </div>
            <div
              class="knowledge-panel__body knowledge-panel__body--graph"
              data-chart="graph"
            ></div>
          </section>

          <section class="knowledge-panel">
            <div class="knowledge-panel__header">
              <div>
                <h2>更新时间热力图</h2>
                <p>查看最近 20 周的写作和整理节奏。</p>
              </div>
            </div>
            <div class="knowledge-panel__body" data-chart="activity"></div>
          </section>

          <section class="knowledge-panel">
            <div class="knowledge-panel__header">
              <div>
                <h2>标签分布</h2>
                <p>识别最常出现的主题与知识簇。</p>
              </div>
            </div>
            <div class="knowledge-panel__body" data-chart="tags"></div>
          </section>
        </div>

        <section class="knowledge-panel knowledge-panel--table">
          <div class="knowledge-panel__header knowledge-panel__header--toolbar">
            <div>
              <h2>知识索引表</h2>
              <p>按标题、标签或目录搜索，快速筛出重点笔记。</p>
            </div>
            <div class="knowledge-toolbar">
              <input type="search" placeholder="搜索标题 / 标签 / 目录" data-table-filter />
              <select data-table-sort>
                <option value="links">按连接度</option>
                <option value="recent">按最近更新</option>
                <option value="size">按内容量</option>
                <option value="title">按标题</option>
              </select>
            </div>
          </div>
          <div class="knowledge-table-wrap">
            <table class="knowledge-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>目录</th>
                  <th>标签</th>
                  <th>连接度</th>
                  <th>内容量</th>
                  <th>更新日期</th>
                </tr>
              </thead>
              <tbody data-table-body></tbody>
            </table>
            <p class="knowledge-table__empty" data-table-empty hidden>
              没有匹配结果。
            </p>
          </div>
        </section>
      </section>
    )
  }

  KnowledgeDashboard.css = style
  KnowledgeDashboard.afterDOMLoaded = script

  return KnowledgeDashboard
}) satisfies QuartzComponentConstructor<Partial<Options>>
