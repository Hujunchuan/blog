# ADR 005: Adopt a Nervous System Layer for Knowledge Graph Evolution

## Status

Accepted

## Context

当前系统已经具备文档级知识站能力，但图谱层仍然主要依赖：

- 文档 slug
- 文档 links
- 目录投影

这种模式适合第一阶段快速落地，但不适合后续的高阶能力：

- 实体级关联
- 决策链追踪
- 影响分析
- 流程建模
- AI 工具调用

## Decision

在现有文档层之上，增加一层“nervous system”。

第一阶段只引入最小结构：

- `entities`
- `relations`

并在 core 层引入：

- `KnowledgeEntity`
- `KnowledgeRelation`

## Consequences

正向影响：

- 不需要推翻现有动态站点
- 可以渐进接入更高阶图谱能力
- 为 AI / MCP 工具层预留统一查询模型

代价：

- 同步流程会变复杂
- 数据模型从文档中心转向文档 + 实体双层中心
- 后续需要补实体抽取与关系抽取逻辑

## Follow-up

下一阶段优先完成：

1. entities / relations 的最小持久化
2. tags / links 驱动的基础抽取
3. related / impact 查询 API
