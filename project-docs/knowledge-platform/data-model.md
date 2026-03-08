# 数据模型

## 核心实体

### Source

表示一个知识源。

- `id`
- `name`
- `type`: `local | github | server`
- `location`
- `enabled`
- `description`
- `settings`

### Document

统一文档实体。

- `id`
- `sourceId`
- `relativePath`
- `slug`
- `title`
- `content`
- `summary`
- `tags`
- `links`
- `headings`
- `updatedAt`
- `contentHash`

### SyncRun

- `id`
- `sourceId`
- `status`
- `startedAt`
- `finishedAt`
- `stats`
- `errorMessage`

## 第一阶段落点

内存模型仍然保留：

- `documents[]`
- `tree`
- `graph`
- `overview`

数据库模型当前已落地：

- `sources`
- `documents`
- `sync_runs`
- `entities`
- `relations`

## PostgreSQL 表

### `sources`

- 主键：`id`
- 当前状态：已落地并用于 persist

### `documents`

- 主键：`id`
- 唯一键：`source_id + relative_path`
- 索引：`source_id`
- 索引：`source_id + slug`
- 索引：`updated_at desc`
- 当前以 `jsonb` 存储：
  - `tags`
  - `links`
  - `headings`

### `sync_runs`

- 主键：`id`
- 索引：`source_id`
- 索引：`started_at desc`

### `entities`

- 主键：`id`
- 唯一键：`source_id + entity_key`
- 索引：`source_id`
- 索引：`source_id + entity_type`
- 索引：`source_id + slug`
- 索引：`source_id + document_slug`
- 用途：承接概念、人物、项目、任务、标签等知识实体
- 当前第一版已实际写入：
  - `document`
  - `tag`

### `relations`

- 主键：`id`
- 唯一键：`source_id + relation_key`
- 索引：`source_id`
- 索引：`source_id + relation_type`
- 索引：`source_id + from_entity_key`
- 索引：`source_id + to_entity_key`
- 索引：`source_id + evidence_document_slug`
- 用途：承接实体间的结构化关系与证据来源
- 当前第一版已实际写入：
  - `belongs_to`
  - `references`

## 当前查询模型

PostgreSQL 已支持直接回读：

- 概览统计
- 最近更新
- top tags
- densest documents
- 搜索结果
- 单篇文档
- Explorer 树
- 图谱节点与边

其中 Explorer 和图谱当前不是单独建表，而是从 `documents` 中的 `slug / links` 投影生成。这一做法的优点是：

- schema 简单
- 与快照算法保持一致
- 迁移成本低

代价是：

- 查询时需要重新投影
- 大规模数据下性能不会是最终形态

## 下一阶段演进

后续如果知识规模继续增长，再考虑补充：

- `document_links`
- `tags`
- `document_tags`
- 物化图谱表或缓存表
- `clusters`
- `cluster_members`
- `processes`
- `process_steps`
- `process_edges`

## Nervous System 第一版抽取规则

### 实体生成

1. 每篇文档生成一个 `document` 实体
2. 每个标签生成一个 `tag` 实体

### 关系生成

1. 文档到标签生成 `belongs_to`
2. 文档到内部链接目标文档生成 `references`

### 当前限制

- 还没有人物、项目、决策、任务的显式抽取
- 还没有 unresolved link 的占位实体
- 还没有 clusters / processes

## 重要约束

- `slug` 只要求在单个 `sourceId` 内唯一
- 全局标识应视为 `sourceId + relativePath`
- 删除文件时必须同步清理该 `sourceId` 下旧文档记录
