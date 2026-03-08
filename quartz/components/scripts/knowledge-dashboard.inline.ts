import * as d3 from "d3"
import { FullSlug, resolveRelative, slugTag } from "../../util/path"
import { removeAllChildren } from "./util"

type DashboardOverview = {
  notes: number
  links: number
  folders: number
  tags: number
  avgContentSize: number
  orphans: number
  activeDays: number
  densestNote?: { slug: FullSlug; title: string }
  freshestNote?: { slug: FullSlug; title: string }
}

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

type DashboardTag = {
  tag: string
  count: number
}

type DashboardData = {
  generatedAt: string
  overview: DashboardOverview
  notes: DashboardNote[]
  links: DashboardLink[]
  tags: DashboardTag[]
}

const numberFormatter = new Intl.NumberFormat("zh-CN")
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" })
const dayFormatter = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" })
const monthFormatter = new Intl.DateTimeFormat("zh-CN", { month: "short" })

const chartCleanups: Array<() => void> = []

function clearChartCleanups() {
  while (chartCleanups.length > 0) {
    chartCleanups.pop()?.()
  }
}

function navigateTo(currentSlug: FullSlug, target: FullSlug) {
  const relative = resolveRelative(currentSlug, target)
  window.spaNavigate(new URL(relative, window.location.toString()))
}

function navigateToTag(currentSlug: FullSlug, tag: string) {
  const target = `tags/${slugTag(tag)}` as FullSlug
  navigateTo(currentSlug, target)
}

function renderEmptyState(host: HTMLElement, message: string) {
  removeAllChildren(host)
  const empty = document.createElement("div")
  empty.className = "knowledge-empty-state"
  empty.textContent = message
  host.appendChild(empty)
}

function setStat(container: HTMLElement, key: string, value: number | string) {
  const target = container.querySelector(`[data-stat="${key}"]`)
  if (target) {
    target.textContent = typeof value === "number" ? numberFormatter.format(value) : value
  }
}

function setHighlight(
  container: HTMLElement,
  key: "densest" | "freshest",
  item: DashboardOverview["densestNote"],
  currentSlug: FullSlug,
) {
  const link = container.querySelector(`[data-highlight-link="${key}"]`) as HTMLAnchorElement | null
  if (!link) return

  if (!item) {
    link.textContent = "--"
    link.href = "."
    return
  }

  link.textContent = item.title
  link.href = resolveRelative(currentSlug, item.slug)
}

function renderOverview(container: HTMLElement, data: DashboardData, currentSlug: FullSlug) {
  const generatedAt = container.querySelector("[data-generated-at]")
  if (generatedAt) {
    generatedAt.textContent = dateFormatter.format(new Date(data.generatedAt))
  }

  setStat(container, "notes", data.overview.notes)
  setStat(container, "links", data.overview.links)
  setStat(container, "folders", data.overview.folders)
  setStat(container, "tags", data.overview.tags)
  setStat(container, "avgContentSize", data.overview.avgContentSize)
  setStat(container, "orphans", data.overview.orphans)
  setStat(container, "activeDays", data.overview.activeDays)
  setHighlight(container, "densest", data.overview.densestNote, currentSlug)
  setHighlight(container, "freshest", data.overview.freshestNote, currentSlug)
}

function buildTreemapTree(notes: DashboardNote[]) {
  const root: { name: string; children: any[] } = { name: "知识库", children: [] }

  for (const note of notes) {
    const segments = note.folder === "根目录" ? [] : note.folder.split("/")
    let cursor = root

    for (const segment of segments) {
      let child = cursor.children.find((item) => item.name === segment && item.children)
      if (!child) {
        child = { name: segment, children: [] }
        cursor.children.push(child)
      }
      cursor = child
    }

    cursor.children.push({
      name: note.title,
      value: Math.max(note.contentSize, 1),
      note,
    })
  }

  return root
}

function renderTreemap(host: HTMLElement, data: DashboardData, currentSlug: FullSlug) {
  if (data.notes.length === 0) {
    renderEmptyState(host, "没有可用于分析的笔记。")
    return
  }

  const draw = () => {
    removeAllChildren(host)
    const width = Math.max(host.clientWidth, 320)
    const height = 340
    const color = d3.scaleOrdinal(d3.schemeTableau10)

    const hierarchy = d3
      .hierarchy(buildTreemapTree(data.notes))
      .sum((d: any) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    d3.treemap<any>().size([width, height]).paddingOuter(8).paddingTop(24).paddingInner(6)(
      hierarchy,
    )

    const svg = d3
      .select(host)
      .append("svg")
      .attr("class", "knowledge-chart-svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")

    const leaves = hierarchy.leaves() as Array<d3.HierarchyRectangularNode<any>>
    const groups = svg
      .selectAll("g")
      .data(leaves)
      .enter()
      .append("g")
      .attr("class", "knowledge-treemap-node")
      .attr("transform", (d: any) => `translate(${d.x0},${d.y0})`)
      .on("click", (_, d: any) => navigateTo(currentSlug, d.data.note.slug))

    groups
      .append("rect")
      .attr("width", (d: any) => Math.max(d.x1 - d.x0, 0))
      .attr("height", (d: any) => Math.max(d.y1 - d.y0, 0))
      .attr("rx", 16)
      .attr("fill", (d: any) => {
        const section = d.data.note.section === "根目录" ? "root" : d.data.note.section
        return color(section) as string
      })
      .attr("fill-opacity", 0.82)

    groups
      .append("text")
      .attr("x", 12)
      .attr("y", 22)
      .attr("fill", "white")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .each(function (d: any) {
        const width = d.x1 - d.x0
        const height = d.y1 - d.y0
        if (width < 88 || height < 48) {
          d3.select(this).remove()
          return
        }

        const note = d.data.note as DashboardNote
        const text = d3.select(this)
        text.append("tspan").text(note.title.slice(0, 30))
        text
          .append("tspan")
          .attr("x", 12)
          .attr("dy", 18)
          .attr("font-size", 11)
          .attr("font-weight", 500)
          .attr("fill-opacity", 0.86)
          .text(`${numberFormatter.format(note.contentSize)} 内容量`)
      })

    groups
      .append("title")
      .text(
        (d: any) =>
          `${d.data.note.title}\n目录: ${d.data.note.folder}\n内容量: ${numberFormatter.format(d.data.note.contentSize)}`,
      )
  }

  draw()
  const observer = new ResizeObserver(draw)
  observer.observe(host)
  chartCleanups.push(() => observer.disconnect())
}

function renderGraph(
  host: HTMLElement,
  data: DashboardData,
  currentSlug: FullSlug,
  graphLimit: number,
) {
  if (data.notes.length === 0) {
    renderEmptyState(host, "没有图谱数据。")
    return
  }

  const rankedNotes = [...data.notes]
    .sort((a, b) => b.linkScore - a.linkScore || b.contentSize - a.contentSize)
    .slice(0, graphLimit)

  const selected = new Set(rankedNotes.map((note) => note.slug))
  const links = data.links.filter((link) => selected.has(link.source) && selected.has(link.target))
  if (rankedNotes.length === 0) {
    renderEmptyState(host, "没有可展示的图谱节点。")
    return
  }

  const draw = () => {
    removeAllChildren(host)
    const width = Math.max(host.clientWidth, 320)
    const height = 390

    const color = d3.scaleOrdinal(d3.schemeTableau10)
    const linkScoreExtent = d3.extent(rankedNotes, (d) => d.linkScore) as [number, number]
    const radius = d3
      .scaleLinear()
      .domain([linkScoreExtent[0] ?? 0, Math.max(linkScoreExtent[1] ?? 1, 1)])
      .range([5, 16])

    const nodes = rankedNotes.map((note) => ({ ...note }))
    const nodeMap = new Map(nodes.map((node) => [node.slug, node]))
    const simLinks = links
      .map((link) => ({
        source: nodeMap.get(link.source),
        target: nodeMap.get(link.target),
      }))
      .filter(
        (link): link is { source: DashboardNote; target: DashboardNote } =>
          !!link.source && !!link.target,
      )

    const svg = d3
      .select(host)
      .append("svg")
      .attr("class", "knowledge-chart-svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")

    const root = svg.append("g")
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.6, 3])
        .on("zoom", (event) => {
          root.attr("transform", event.transform.toString())
        }),
    )

    const line = root
      .append("g")
      .attr("stroke", "var(--lightgray)")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("stroke-width", 1.2)

    const label = root
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("font-size", 10)
      .attr("fill", "var(--dark)")
      .attr("text-anchor", "middle")
      .attr("dy", -11)
      .text((d) => d.title.slice(0, 14))

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(simLinks as any)
          .id((d: any) => d.slug)
          .distance(52),
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<d3.SimulationNodeDatum>((d: any) => radius(d.linkScore) + 7),
      )

    const node = root
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("class", "knowledge-graph-node")
      .attr("r", (d) => radius(d.linkScore))
      .attr("fill", (d) => color(d.section === "根目录" ? "root" : d.section) as string)
      .attr("fill-opacity", 0.88)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .on("click", (_, d) => navigateTo(currentSlug, d.slug))
      .call(
        d3
          .drag<SVGCircleElement, DashboardNote>()
          .on("start", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0.16).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on("drag", (event, d: any) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on("end", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    node.append("title").text((d) => `${d.title}\n连接度: ${d.linkScore}\n目录: ${d.folder}`)

    simulation.on("tick", () => {
      line
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y)
      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)
    })

    chartCleanups.push(() => simulation.stop())
  }

  draw()
  const observer = new ResizeObserver(draw)
  observer.observe(host)
  chartCleanups.push(() => observer.disconnect())
}

function getRecentActivity(notes: DashboardNote[]) {
  const counts = new Map<string, number>()
  for (const note of notes) {
    if (!note.date) continue
    const key = note.date.slice(0, 10)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = d3.range(140).map((offset) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (139 - offset))
    const key = date.toISOString().slice(0, 10)
    return {
      date,
      key,
      count: counts.get(key) ?? 0,
    }
  })

  return days
}

function renderActivity(host: HTMLElement, data: DashboardData) {
  const days = getRecentActivity(data.notes)
  if (days.length === 0) {
    renderEmptyState(host, "没有时间维度数据。")
    return
  }

  const draw = () => {
    removeAllChildren(host)
    const cell = 16
    const gap = 4
    const labelWidth = 34
    const width = Math.max(host.clientWidth, 320)
    const weeks = Math.ceil(days.length / 7)
    const height = 7 * (cell + gap) + 42
    const maxCount = d3.max(days, (d) => d.count) ?? 0
    const color = d3.scaleSequential(d3.interpolateYlGnBu).domain([0, Math.max(maxCount, 1)])

    const svg = d3
      .select(host)
      .append("svg")
      .attr("class", "knowledge-chart-svg")
      .attr("viewBox", `0 0 ${Math.max(width, weeks * (cell + gap) + labelWidth)} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")

    const labels = ["日", "一", "二", "三", "四", "五", "六"]
    svg
      .append("g")
      .selectAll("text")
      .data(labels)
      .enter()
      .append("text")
      .attr("class", "knowledge-tooltip")
      .attr("x", 0)
      .attr("y", (_, index) => index * (cell + gap) + 18)
      .text((d) => d)

    const monthMarkers = new Map<number, string>()
    days.forEach((day, index) => {
      if (day.date.getDate() <= 7) {
        monthMarkers.set(Math.floor(index / 7), monthFormatter.format(day.date))
      }
    })

    svg
      .append("g")
      .selectAll("text")
      .data(Array.from(monthMarkers.entries()))
      .enter()
      .append("text")
      .attr("class", "knowledge-tooltip")
      .attr("x", ([week]) => labelWidth + week * (cell + gap))
      .attr("y", 12)
      .text(([, label]) => label)

    svg
      .append("g")
      .selectAll("rect")
      .data(days)
      .enter()
      .append("rect")
      .attr("class", "knowledge-activity-day")
      .attr("x", (_, index) => labelWidth + Math.floor(index / 7) * (cell + gap))
      .attr("y", (d) => 20 + d.date.getDay() * (cell + gap))
      .attr("width", cell)
      .attr("height", cell)
      .attr("rx", 4)
      .attr("fill", (d) => (d.count === 0 ? "var(--lightgray)" : color(d.count)))
      .append("title")
      .text((d) => `${dayFormatter.format(d.date)}: ${d.count} 条更新`)
  }

  draw()
  const observer = new ResizeObserver(draw)
  observer.observe(host)
  chartCleanups.push(() => observer.disconnect())
}

function renderTags(host: HTMLElement, data: DashboardData, currentSlug: FullSlug) {
  const tags = data.tags.slice(0, 10)
  if (tags.length === 0) {
    renderEmptyState(host, "当前还没有标签数据。")
    return
  }

  const draw = () => {
    removeAllChildren(host)
    const width = Math.max(host.clientWidth, 320)
    const height = Math.max(tags.length * 32 + 24, 220)
    const margin = { top: 8, right: 18, bottom: 12, left: 86 }

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(tags, (d) => d.count) ?? 1])
      .range([margin.left, width - margin.right])

    const y = d3
      .scaleBand()
      .domain(tags.map((d) => d.tag))
      .range([margin.top, height - margin.bottom])
      .padding(0.18)

    const svg = d3
      .select(host)
      .append("svg")
      .attr("class", "knowledge-chart-svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")

    svg
      .append("g")
      .selectAll("rect")
      .data(tags)
      .enter()
      .append("rect")
      .attr("class", "knowledge-tag-bar")
      .attr("x", margin.left)
      .attr("y", (d) => y(d.tag) ?? 0)
      .attr("width", (d) => x(d.count) - margin.left)
      .attr("height", y.bandwidth())
      .attr("rx", 10)
      .attr("fill", "var(--secondary)")
      .attr("fill-opacity", 0.82)
      .style("cursor", "pointer")
      .on("click", (_, d) => navigateToTag(currentSlug, d.tag))

    svg
      .append("g")
      .selectAll("text.label")
      .data(tags)
      .enter()
      .append("text")
      .attr("class", "knowledge-tooltip")
      .attr("x", margin.left - 10)
      .attr("y", (d) => (y(d.tag) ?? 0) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "end")
      .text((d) => d.tag)

    svg
      .append("g")
      .selectAll("text.value")
      .data(tags)
      .enter()
      .append("text")
      .attr("class", "knowledge-tooltip")
      .attr("x", (d) => x(d.count) + 8)
      .attr("y", (d) => (y(d.tag) ?? 0) + y.bandwidth() / 2 + 4)
      .text((d) => numberFormatter.format(d.count))
  }

  draw()
  const observer = new ResizeObserver(draw)
  observer.observe(host)
  chartCleanups.push(() => observer.disconnect())
}

function buildTagCell(tags: string[]) {
  const wrapper = document.createElement("div")
  if (tags.length === 0) {
    wrapper.textContent = "--"
    return wrapper
  }

  for (const tag of tags.slice(0, 4)) {
    const chip = document.createElement("span")
    chip.className = "knowledge-tag-chip"
    chip.textContent = tag
    wrapper.appendChild(chip)
  }

  return wrapper
}

function renderTable(container: HTMLElement, data: DashboardData, currentSlug: FullSlug) {
  const tbody = container.querySelector("[data-table-body]") as HTMLTableSectionElement | null
  const empty = container.querySelector("[data-table-empty]") as HTMLElement | null
  const filter = container.querySelector("[data-table-filter]") as HTMLInputElement | null
  const sort = container.querySelector("[data-table-sort]") as HTMLSelectElement | null
  if (!tbody || !empty || !filter || !sort) return

  const renderRows = () => {
    const query = filter.value.trim().toLowerCase()
    const sortBy = sort.value
    const filtered = data.notes.filter((note) => {
      if (!query) return true
      return [note.title, note.folder, note.section, note.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })

    filtered.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title, "zh-CN")
      if (sortBy === "size") return b.contentSize - a.contentSize
      if (sortBy === "recent") {
        const aTime = a.date ? new Date(a.date).getTime() : 0
        const bTime = b.date ? new Date(b.date).getTime() : 0
        return bTime - aTime
      }
      return b.linkScore - a.linkScore || b.contentSize - a.contentSize
    })

    removeAllChildren(tbody)
    empty.hidden = filtered.length > 0

    for (const note of filtered.slice(0, 200)) {
      const row = document.createElement("tr")

      const titleCell = document.createElement("td")
      const link = document.createElement("a")
      link.href = resolveRelative(currentSlug, note.slug)
      link.textContent = note.title
      titleCell.appendChild(link)

      const folderCell = document.createElement("td")
      folderCell.textContent = note.folder

      const tagsCell = document.createElement("td")
      tagsCell.appendChild(buildTagCell(note.tags))

      const linkCell = document.createElement("td")
      linkCell.textContent = numberFormatter.format(note.linkScore)

      const sizeCell = document.createElement("td")
      sizeCell.textContent = numberFormatter.format(note.contentSize)

      const dateCell = document.createElement("td")
      dateCell.textContent = note.date ? dateFormatter.format(new Date(note.date)) : "--"

      row.append(titleCell, folderCell, tagsCell, linkCell, sizeCell, dateCell)
      tbody.appendChild(row)
    }
  }

  renderRows()
  filter.addEventListener("input", renderRows)
  sort.addEventListener("change", renderRows)
  chartCleanups.push(() => {
    filter.removeEventListener("input", renderRows)
    sort.removeEventListener("change", renderRows)
  })
}

async function renderDashboard(container: HTMLElement, currentSlug: FullSlug) {
  const source = container.dataset.source
  if (!source) return

  const response = await fetch(source)
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data: ${response.status}`)
  }

  const data = (await response.json()) as DashboardData
  const graphLimit = Number(container.dataset.graphLimit ?? "120")

  renderOverview(container, data, currentSlug)

  const treemap = container.querySelector('[data-chart="treemap"]') as HTMLElement | null
  const graph = container.querySelector('[data-chart="graph"]') as HTMLElement | null
  const activity = container.querySelector('[data-chart="activity"]') as HTMLElement | null
  const tags = container.querySelector('[data-chart="tags"]') as HTMLElement | null

  if (treemap) renderTreemap(treemap, data, currentSlug)
  if (graph) renderGraph(graph, data, currentSlug, graphLimit)
  if (activity) renderActivity(activity, data)
  if (tags) renderTags(tags, data, currentSlug)
  renderTable(container, data, currentSlug)
}

document.addEventListener("nav", async (event: CustomEventMap["nav"]) => {
  clearChartCleanups()

  const container = document.querySelector(".knowledge-dashboard") as HTMLElement | null
  if (!container) return

  try {
    await renderDashboard(container, event.detail.url)
  } catch (error) {
    const panels = container.querySelectorAll("[data-chart]")
    panels.forEach((panel) =>
      renderEmptyState(panel as HTMLElement, "数据加载失败，请重新构建站点后再试。"),
    )
    console.error(error)
  }
})
