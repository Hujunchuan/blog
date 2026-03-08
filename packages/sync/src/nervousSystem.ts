import {
  ImpactKnowledgeEntity,
  ImpactKnowledgeRelation,
  KnowledgeEntity,
  KnowledgeEntityType,
  KnowledgeImpactResult,
  KnowledgeRelation,
  KnowledgeNervousSystemSnapshot,
  ParsedKnowledgeDocument,
} from "../../core/src"
import { resolveInternalTarget } from "./projections"

const projectKeywordPatterns = [
  /项目/u,
  /系统/u,
  /平台/u,
  /图谱/u,
  /知识库/u,
  /机器人/u,
  /工作流/u,
  /数据库/u,
  /小程序/u,
  /飞书/u,
  /导师/u,
  /OpenCloud/i,
  /Openclaw/i,
  /\bbot\b/i,
  /\bVR\b/i,
]

const conceptSkipValues = new Set([
  "会议原文",
  "待整理书面语",
  "原文",
  "讨论",
  "探讨",
  "总结",
  "复盘",
  "开发讨论",
  "团队讨论",
])

const leadingNoisePatterns = [/^[#*\-\d.\s]+/u, /^\[待整理书面语\]/u, /^关于/u, /^基于/u, /^面向/u, /^针对/u]
const trailingNoisePatterns = [
  /的探讨$/u,
  /的讨论$/u,
  /的总结$/u,
  /探讨$/u,
  /讨论$/u,
  /总结$/u,
  /复盘$/u,
  /原文$/u,
]
const speakerPatterns = [
  /\*\*([^*\n]{2,16})\*\*\[\d{2}:\d{2}:\d{2}\]/gu,
  /(?:^|\n)\s*([\p{Script=Han}A-Za-z]{2,16})\s*\[\d{2}:\d{2}:\d{2}\]/gu,
]
const splitPattern = /[、，,；;：:/|（）()]+|(?:\s+vs\s+)|与|和|及/gu
const chineseSurnameSet = new Set([
  "赵",
  "钱",
  "孙",
  "李",
  "周",
  "吴",
  "郑",
  "王",
  "冯",
  "陈",
  "褚",
  "卫",
  "蒋",
  "沈",
  "韩",
  "杨",
  "朱",
  "秦",
  "尤",
  "许",
  "何",
  "吕",
  "施",
  "张",
  "孔",
  "曹",
  "严",
  "华",
  "金",
  "魏",
  "陶",
  "姜",
  "戚",
  "谢",
  "邹",
  "喻",
  "柏",
  "水",
  "窦",
  "章",
  "云",
  "苏",
  "潘",
  "葛",
  "奚",
  "范",
  "彭",
  "郎",
  "鲁",
  "韦",
  "昌",
  "马",
  "苗",
  "凤",
  "花",
  "方",
  "俞",
  "任",
  "袁",
  "柳",
  "酆",
  "鲍",
  "史",
  "唐",
  "费",
  "廉",
  "岑",
  "薛",
  "雷",
  "贺",
  "倪",
  "汤",
  "滕",
  "殷",
  "罗",
  "毕",
  "郝",
  "邬",
  "安",
  "常",
  "乐",
  "于",
  "时",
  "傅",
  "皮",
  "卞",
  "齐",
  "康",
  "伍",
  "余",
  "元",
  "卜",
  "顾",
  "孟",
  "平",
  "黄",
  "和",
  "穆",
  "萧",
  "尹",
  "姚",
  "邵",
  "湛",
  "汪",
  "祁",
  "毛",
  "禹",
  "狄",
  "米",
  "贝",
  "明",
  "臧",
  "计",
  "伏",
  "成",
  "戴",
  "谈",
  "宋",
  "茅",
  "庞",
  "熊",
  "纪",
  "舒",
  "屈",
  "项",
  "祝",
  "董",
  "梁",
  "杜",
  "阮",
  "蓝",
  "闵",
  "席",
  "季",
  "麻",
  "强",
  "贾",
  "路",
  "娄",
  "危",
  "江",
  "童",
  "颜",
  "郭",
  "梅",
  "盛",
  "林",
  "刁",
  "钟",
  "徐",
  "邱",
  "骆",
  "高",
  "夏",
  "蔡",
  "田",
  "樊",
  "胡",
  "凌",
  "霍",
  "虞",
  "万",
  "支",
  "柯",
  "昝",
  "管",
  "卢",
  "莫",
  "经",
  "房",
  "裘",
  "缪",
  "干",
  "解",
  "应",
  "宗",
  "丁",
  "宣",
  "贲",
  "邓",
  "郁",
  "单",
  "杭",
  "洪",
  "包",
  "诸",
  "左",
  "石",
  "崔",
  "吉",
  "钮",
  "龚",
  "程",
  "嵇",
  "邢",
  "滑",
  "裴",
  "陆",
  "荣",
  "翁",
  "荀",
  "羊",
  "于",
  "惠",
  "甄",
  "曲",
  "家",
  "封",
  "芮",
  "羿",
  "储",
  "靳",
  "汲",
  "邴",
  "糜",
  "松",
  "井",
  "段",
  "富",
  "巫",
  "乌",
  "焦",
  "巴",
  "弓",
  "牧",
  "隗",
  "山",
  "谷",
  "车",
  "侯",
  "宓",
  "蓬",
  "全",
  "郗",
  "班",
  "仰",
  "秋",
  "仲",
  "伊",
  "宫",
  "宁",
  "仇",
  "栾",
  "暴",
  "甘",
  "钭",
  "厉",
  "戎",
  "祖",
  "武",
  "符",
  "刘",
  "景",
  "詹",
  "束",
  "龙",
  "叶",
  "幸",
  "司",
  "韶",
  "郜",
  "黎",
  "蓟",
  "薄",
  "印",
  "宿",
  "白",
  "怀",
  "蒲",
  "台",
  "从",
  "鄂",
  "索",
  "咸",
  "籍",
  "赖",
  "卓",
  "蔺",
  "屠",
  "蒙",
  "池",
  "乔",
  "阴",
  "郁",
  "胥",
  "能",
  "苍",
  "双",
  "闻",
  "莘",
  "党",
  "翟",
  "谭",
  "贡",
  "劳",
  "逄",
  "姬",
  "申",
  "扶",
  "堵",
  "冉",
  "宰",
  "郦",
  "雍",
  "璩",
  "桑",
  "桂",
  "濮",
  "牛",
  "寿",
  "通",
  "边",
  "扈",
  "燕",
  "冀",
  "郏",
  "浦",
  "尚",
  "农",
  "温",
  "别",
  "庄",
  "晏",
  "柴",
  "瞿",
  "阎",
  "充",
  "慕",
  "连",
  "茹",
  "习",
  "宦",
  "艾",
  "鱼",
  "容",
  "向",
  "古",
  "易",
  "慎",
  "戈",
  "廖",
  "庾",
  "终",
  "暨",
  "居",
  "衡",
  "步",
  "都",
  "耿",
  "满",
  "弘",
  "匡",
  "国",
  "文",
  "寇",
  "广",
  "禄",
  "阙",
  "东",
  "欧",
  "殳",
  "沃",
  "利",
  "蔚",
  "越",
  "夔",
  "隆",
  "师",
  "巩",
  "厍",
  "聂",
  "晁",
  "勾",
  "敖",
  "融",
  "冷",
  "訾",
  "辛",
  "阚",
  "那",
  "简",
  "饶",
  "空",
  "曾",
  "毋",
  "沙",
  "乜",
  "养",
  "鞠",
  "须",
  "丰",
  "巢",
  "关",
  "蒯",
  "相",
  "查",
  "后",
  "荆",
  "红",
  "游",
  "竺",
  "权",
  "逯",
  "盖",
  "益",
  "桓",
  "公",
  "仉",
  "督",
  "岳",
  "帅",
  "缑",
  "亢",
  "况",
  "郈",
  "有",
  "琴",
  "归",
  "海",
  "晋",
  "楚",
  "阎",
  "法",
  "汝",
  "鄢",
  "涂",
  "钦",
  "岳",
])
const personHonorificSuffixes = ["法师", "师兄", "师姐", "老师", "师傅", "师父"]
const compoundChineseSurnames = new Set([
  "欧阳",
  "司马",
  "上官",
  "诸葛",
  "东方",
  "独孤",
  "南宫",
  "夏侯",
  "尉迟",
  "长孙",
  "慕容",
  "宇文",
  "司徒",
  "闻人",
  "皇甫",
])
const personCandidateDenyValues = new Set([
  "任务管理",
  "关照",
  "双链",
  "宣传",
  "家庭支持",
  "文化差异",
  "文明",
  "文明悖论",
  "文本数据",
  "时代契机",
  "法界",
  "法界意识",
  "法界智慧",
  "经济",
  "经济压力",
  "通用智能",
  "项目开发",
  "项目管理",
])
const personCandidateDenyPatterns = [
  /管理$/u,
  /开发$/u,
  /支持$/u,
  /差异$/u,
  /意识$/u,
  /智慧$/u,
  /数据$/u,
  /压力$/u,
  /智能$/u,
  /契机$/u,
  /悖论$/u,
  /系统$/u,
  /平台$/u,
  /图谱$/u,
  /知识库$/u,
  /工作流$/u,
  /数据库$/u,
  /模型$/u,
  /方法$/u,
  /方案$/u,
]

function normalizeTagKey(tag: string) {
  return encodeURIComponent(tag.trim().replace(/\s+/g, " "))
}

function normalizeTypedKey(value: string) {
  return encodeURIComponent(value.trim().replace(/\s+/g, " "))
}

function documentEntityKey(document: ParsedKnowledgeDocument) {
  return `document:${document.slug}`
}

function tagEntityKey(tag: string) {
  return `tag:${normalizeTagKey(tag)}`
}

function typedEntityKey(entityType: Exclude<KnowledgeEntityType, "document" | "meeting" | "task" | "practice" | "decision">, name: string) {
  return `${entityType}:${normalizeTypedKey(name)}`
}

function relationKey(relationType: KnowledgeRelation["relationType"], fromEntityKey: string, toEntityKey: string) {
  return `${relationType}:${fromEntityKey}->${toEntityKey}`
}

function mergeMetadata(
  current?: Record<string, unknown>,
  incoming?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!current && !incoming) {
    return undefined
  }

  const merged: Record<string, unknown> = {
    ...(current ?? {}),
    ...(incoming ?? {}),
  }
  const sources = new Set<string>()

  for (const candidate of [current, incoming]) {
    const source = candidate?.source
    if (typeof source === "string") {
      sources.add(source)
    }

    const extraSources = candidate?.sources
    if (Array.isArray(extraSources)) {
      for (const item of extraSources) {
        if (typeof item === "string") {
          sources.add(item)
        }
      }
    }
  }

  if (sources.size > 0) {
    merged.sources = [...sources].sort((a, b) => a.localeCompare(b, "en"))
  }

  return merged
}

function createDocumentEntity(document: ParsedKnowledgeDocument): KnowledgeEntity {
  return {
    sourceId: document.sourceId,
    entityKey: documentEntityKey(document),
    entityType: "document",
    canonicalName: document.title,
    slug: document.slug,
    documentSlug: document.slug,
    metadata: {
      relativePath: document.relativePath,
      tagCount: document.tags.length,
      linkCount: document.links.length,
      source: "document",
    },
  }
}

function createTagEntity(sourceId: string, tag: string): KnowledgeEntity {
  return {
    sourceId,
    entityKey: tagEntityKey(tag),
    entityType: "tag",
    canonicalName: tag,
    metadata: {
      source: "document-tag",
    },
  }
}

function createTypedEntity(
  sourceId: string,
  entityType: "concept" | "person" | "project",
  name: string,
  metadata?: Record<string, unknown>,
): KnowledgeEntity {
  return {
    sourceId,
    entityKey: typedEntityKey(entityType, name),
    entityType,
    canonicalName: name,
    metadata: mergeMetadata(
      {
        source: entityType,
      },
      metadata,
    ),
  }
}

function normalizeCandidate(value: string) {
  let normalized = value
    .replace(/\.(md|mdx)$/iu, "")
    .replace(/\s+/gu, " ")
    .trim()

  for (const pattern of leadingNoisePatterns) {
    normalized = normalized.replace(pattern, "").trim()
  }

  for (const pattern of trailingNoisePatterns) {
    normalized = normalized.replace(pattern, "").trim()
  }

  return normalized.replace(/^[“"'`【\[（(]+|[”"'`】\]）)]+$/gu, "").trim()
}

function containsHanCharacters(value: string) {
  return /\p{Script=Han}/u.test(value)
}

function isDeniedPersonCandidate(value: string) {
  if (personCandidateDenyValues.has(value)) {
    return true
  }

  if (looksLikeProjectName(value)) {
    return true
  }

  return personCandidateDenyPatterns.some((pattern) => pattern.test(value))
}

function looksLikeBareChineseName(value: string, options?: { allowTwoCharacterName?: boolean }) {
  if (/^[\p{Script=Han}]{2,3}$/u.test(value)) {
    if (value.length === 2 && !options?.allowTwoCharacterName) {
      return false
    }

    return chineseSurnameSet.has(value[0] ?? "")
  }

  if (/^[\p{Script=Han}]{4}$/u.test(value)) {
    return compoundChineseSurnames.has(value.slice(0, 2))
  }

  return false
}

function looksLikePersonName(value: string, options?: { context?: "tag" | "speaker" }) {
  if (!value || !containsHanCharacters(value) || value.length > 8) {
    return false
  }

  if (conceptSkipValues.has(value)) {
    return false
  }

  if (isDeniedPersonCandidate(value)) {
    return false
  }

  for (const suffix of personHonorificSuffixes) {
    if (value.endsWith(suffix)) {
      const prefix = value.slice(0, value.length - suffix.length)
      return prefix.length >= 1 && prefix.length <= 4
    }
  }

  return looksLikeBareChineseName(value, {
    allowTwoCharacterName: options?.context === "speaker",
  })
}

function looksLikeProjectName(value: string) {
  if (!value || value.length < 2 || value.length > 28) {
    return false
  }

  return projectKeywordPatterns.some((pattern) => pattern.test(value))
}

function looksLikeConceptName(value: string) {
  if (!value || value.length < 2 || value.length > 24) {
    return false
  }

  if (conceptSkipValues.has(value)) {
    return false
  }

  return /[\p{Script=Han}A-Za-z]/u.test(value)
}

function classifyTagEntityType(tag: string): "person" | "project" | "concept" | undefined {
  if (looksLikePersonName(tag, { context: "tag" })) {
    return "person"
  }

  if (looksLikeProjectName(tag)) {
    return "project"
  }

  if (looksLikeConceptName(tag)) {
    return "concept"
  }

  return undefined
}

function splitStructuredCandidates(value: string) {
  const normalized = normalizeCandidate(value)
  if (!normalized) {
    return []
  }

  const parts = normalized
    .split(splitPattern)
    .map((item) => normalizeCandidate(item))
    .filter(Boolean)

  return parts.length > 1 ? parts : [normalized]
}

function collectStructuredCandidates(document: ParsedKnowledgeDocument) {
  const concepts = new Set<string>()
  const projects = new Set<string>()
  const sources = [
    { value: document.title, source: "title" },
    ...document.headings.slice(0, 8).map((value) => ({ value, source: "heading" })),
    ...document.slug
      .split("/")
      .slice(0, -1)
      .map((value) => ({ value, source: "path" })),
  ]

  const conceptCandidates = new Map<string, Set<string>>()
  const projectCandidates = new Map<string, Set<string>>()

  const addCandidate = (
    target: Map<string, Set<string>>,
    name: string,
    source: string,
  ) => {
    const bucket = target.get(name) ?? new Set<string>()
    bucket.add(source)
    target.set(name, bucket)
  }

  for (const item of sources) {
    const normalized = normalizeCandidate(item.value)
    if (!normalized) {
      continue
    }

    if (looksLikeProjectName(normalized)) {
      projects.add(normalized)
      addCandidate(projectCandidates, normalized, item.source)
    }

    for (const candidate of splitStructuredCandidates(item.value)) {
      if (looksLikeProjectName(candidate)) {
        projects.add(candidate)
        addCandidate(projectCandidates, candidate, item.source)
        continue
      }

      if (looksLikeConceptName(candidate) && !looksLikePersonName(candidate)) {
        concepts.add(candidate)
        addCandidate(conceptCandidates, candidate, item.source)
      }
    }
  }

  return {
    concepts: [...concepts].map((name) => ({
      name,
      sources: [...(conceptCandidates.get(name) ?? [])].sort((a, b) => a.localeCompare(b, "en")),
    })),
    projects: [...projects].map((name) => ({
      name,
      sources: [...(projectCandidates.get(name) ?? [])].sort((a, b) => a.localeCompare(b, "en")),
    })),
  }
}

function extractSpeakerNames(content: string) {
  const speakers = new Set<string>()

  for (const pattern of speakerPatterns) {
    for (const match of content.matchAll(pattern)) {
      const rawName = normalizeCandidate(match[1] ?? "")
      if (looksLikePersonName(rawName, { context: "speaker" })) {
        speakers.add(rawName)
      }
    }
  }

  return [...speakers]
}

function createTypedMentionRelation(
  document: ParsedKnowledgeDocument,
  entityType: "concept" | "person" | "project",
  name: string,
  metadata?: Record<string, unknown>,
): KnowledgeRelation {
  return {
    sourceId: document.sourceId,
    relationKey: relationKey("mentions", documentEntityKey(document), typedEntityKey(entityType, name)),
    relationType: "mentions",
    fromEntityKey: documentEntityKey(document),
    toEntityKey: typedEntityKey(entityType, name),
    evidenceDocumentSlug: document.slug,
    weight: 1,
    metadata,
  }
}

export function buildKnowledgeNervousSystem(documents: ParsedKnowledgeDocument[]): KnowledgeNervousSystemSnapshot {
  const entityMap = new Map<string, KnowledgeEntity>()
  const relationMap = new Map<string, KnowledgeRelation>()
  const bySlug = new Map(documents.map((document) => [document.slug, document]))
  const byStem = new Map(documents.map((document) => [document.slug.split("/").at(-1) ?? document.slug, document]))

  const upsertEntity = (entity: KnowledgeEntity) => {
    const current = entityMap.get(entity.entityKey)
    if (!current) {
      entityMap.set(entity.entityKey, entity)
      return
    }

    entityMap.set(entity.entityKey, {
      ...current,
      ...entity,
      slug: current.slug ?? entity.slug,
      documentSlug: current.documentSlug ?? entity.documentSlug,
      metadata: mergeMetadata(current.metadata, entity.metadata),
    })
  }

  const upsertRelation = (relation: KnowledgeRelation) => {
    const current = relationMap.get(relation.relationKey)
    if (!current) {
      relationMap.set(relation.relationKey, relation)
      return
    }

    relationMap.set(relation.relationKey, {
      ...current,
      weight: (current.weight ?? 1) + (relation.weight ?? 1),
      metadata: mergeMetadata(current.metadata, relation.metadata),
    })
  }

  for (const document of documents) {
    const fromDocumentKey = documentEntityKey(document)
    upsertEntity(createDocumentEntity(document))

    for (const tag of document.tags) {
      const normalizedTag = normalizeCandidate(tag)
      if (!normalizedTag) {
        continue
      }

      const tagKey = tagEntityKey(normalizedTag)
      const typedEntityType = classifyTagEntityType(normalizedTag)

      upsertEntity(createTagEntity(document.sourceId, normalizedTag))
      upsertRelation({
        sourceId: document.sourceId,
        relationKey: relationKey("belongs_to", fromDocumentKey, tagKey),
        relationType: "belongs_to",
        fromEntityKey: fromDocumentKey,
        toEntityKey: tagKey,
        evidenceDocumentSlug: document.slug,
        weight: 1,
        metadata: {
          source: "tag",
        },
      })

      if (!typedEntityType) {
        continue
      }

      upsertEntity(
        createTypedEntity(document.sourceId, typedEntityType, normalizedTag, {
          source: "tag-derived",
        }),
      )
      upsertRelation(
        createTypedMentionRelation(document, typedEntityType, normalizedTag, {
          source: "tag-derived",
        }),
      )
      upsertRelation({
        sourceId: document.sourceId,
        relationKey: relationKey("related_to", typedEntityKey(typedEntityType, normalizedTag), tagKey),
        relationType: "related_to",
        fromEntityKey: typedEntityKey(typedEntityType, normalizedTag),
        toEntityKey: tagKey,
        evidenceDocumentSlug: document.slug,
        weight: 1,
        metadata: {
          source: "typed-tag-bridge",
        },
      })
    }

    const structuredCandidates = collectStructuredCandidates(document)
    for (const candidate of structuredCandidates.concepts) {
      upsertEntity(
        createTypedEntity(document.sourceId, "concept", candidate.name, {
          source: "structured-text",
          structuredSources: candidate.sources,
        }),
      )
      upsertRelation(
        createTypedMentionRelation(document, "concept", candidate.name, {
          source: "structured-text",
          structuredSources: candidate.sources,
        }),
      )
    }

    for (const candidate of structuredCandidates.projects) {
      upsertEntity(
        createTypedEntity(document.sourceId, "project", candidate.name, {
          source: "structured-text",
          structuredSources: candidate.sources,
        }),
      )
      upsertRelation(
        createTypedMentionRelation(document, "project", candidate.name, {
          source: "structured-text",
          structuredSources: candidate.sources,
        }),
      )
    }

    for (const speakerName of extractSpeakerNames(document.content)) {
      upsertEntity(
        createTypedEntity(document.sourceId, "person", speakerName, {
          source: "speaker",
        }),
      )
      upsertRelation(
        createTypedMentionRelation(document, "person", speakerName, {
          source: "speaker",
        }),
      )
    }

    for (const rawTarget of document.links) {
      const target = resolveInternalTarget(document, rawTarget, bySlug, byStem)
      if (!target || target.slug === document.slug) continue

      upsertEntity(createDocumentEntity(target))
      upsertRelation({
        sourceId: document.sourceId,
        relationKey: relationKey("references", fromDocumentKey, documentEntityKey(target)),
        relationType: "references",
        fromEntityKey: fromDocumentKey,
        toEntityKey: documentEntityKey(target),
        evidenceDocumentSlug: document.slug,
        weight: 1,
        metadata: {
          rawTarget,
          source: "link",
        },
      })
    }
  }

  return {
    entities: [...entityMap.values()].sort((a, b) => a.entityKey.localeCompare(b.entityKey, "en")),
    relations: [...relationMap.values()].sort((a, b) => a.relationKey.localeCompare(b.relationKey, "en")),
  }
}

export function buildKnowledgeImpact(
  nervousSystem: KnowledgeNervousSystemSnapshot,
  rootEntityKey: string,
  options?: { depth?: number; limit?: number },
): KnowledgeImpactResult | null {
  const root = nervousSystem.entities.find((entity) => entity.entityKey === rootEntityKey)
  if (!root) {
    return null
  }

  const maxDepth = Math.max(1, Math.min(options?.depth ?? 2, 6))
  const maxRelations = Math.max(1, Math.min(options?.limit ?? 40, 200))
  const adjacency = new Map<
    string,
    Array<{
      relation: KnowledgeRelation
      nextEntityKey: string
      direction: ImpactKnowledgeRelation["direction"]
    }>
  >()

  for (const relation of nervousSystem.relations) {
    const outgoingEntries = adjacency.get(relation.fromEntityKey) ?? []
    outgoingEntries.push({
      relation,
      nextEntityKey: relation.toEntityKey,
      direction: "outgoing",
    })
    adjacency.set(relation.fromEntityKey, outgoingEntries)

    const incomingEntries = adjacency.get(relation.toEntityKey) ?? []
    incomingEntries.push({
      relation,
      nextEntityKey: relation.fromEntityKey,
      direction: "incoming",
    })
    adjacency.set(relation.toEntityKey, incomingEntries)
  }

  const visitedDepth = new Map<string, number>([[root.entityKey, 0]])
  const impactRelations = new Map<string, ImpactKnowledgeRelation>()
  const queue: Array<{ entityKey: string; depth: number }> = [{ entityKey: root.entityKey, depth: 0 }]

  while (queue.length > 0 && impactRelations.size < maxRelations) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) {
      continue
    }

    const entries = [...(adjacency.get(current.entityKey) ?? [])].sort(
      (a, b) =>
        (b.relation.weight ?? 1) - (a.relation.weight ?? 1) ||
        a.relation.relationType.localeCompare(b.relation.relationType, "en") ||
        a.relation.relationKey.localeCompare(b.relation.relationKey, "en"),
    )

    for (const entry of entries) {
      const nextDepth = current.depth + 1
      const relationInstanceKey = `${entry.relation.relationKey}:${entry.direction}:${nextDepth}`

      if (impactRelations.size < maxRelations && !impactRelations.has(relationInstanceKey)) {
        impactRelations.set(relationInstanceKey, {
          ...entry.relation,
          direction: entry.direction,
          depth: nextDepth,
        })
      }

      const knownDepth = visitedDepth.get(entry.nextEntityKey)
      if (knownDepth === undefined || nextDepth < knownDepth) {
        visitedDepth.set(entry.nextEntityKey, nextDepth)
        if (nextDepth < maxDepth && impactRelations.size < maxRelations) {
          queue.push({ entityKey: entry.nextEntityKey, depth: nextDepth })
        }
      }
    }
  }

  const entityMap = new Map(nervousSystem.entities.map((entity) => [entity.entityKey, entity]))
  const entities: ImpactKnowledgeEntity[] = [...visitedDepth.entries()]
    .map(([entityKey, depth]) => {
      const entity = entityMap.get(entityKey)
      if (!entity) {
        return undefined
      }

      return {
        ...entity,
        depth,
      }
    })
    .filter((entity): entity is ImpactKnowledgeEntity => Boolean(entity))
    .sort(
      (a, b) =>
        a.depth - b.depth ||
        a.entityType.localeCompare(b.entityType, "en") ||
        a.canonicalName.localeCompare(b.canonicalName, "zh-CN"),
    )

  const relations = [...impactRelations.values()].sort(
    (a, b) =>
      a.depth - b.depth ||
      a.direction.localeCompare(b.direction, "en") ||
      a.relationType.localeCompare(b.relationType, "en") ||
      a.relationKey.localeCompare(b.relationKey, "en"),
  )

  return {
    root,
    entities,
    relations,
    summary: {
      maxDepth,
      entityCount: entities.length,
      relationCount: relations.length,
      incomingCount: relations.filter((relation) => relation.direction === "incoming").length,
      outgoingCount: relations.filter((relation) => relation.direction === "outgoing").length,
    },
  }
}
