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

## 重要约束

- `slug` 只要求在单个 `sourceId` 内唯一
- 全局标识应视为 `sourceId + relativePath`
- 删除文件时必须同步清理该 `sourceId` 下旧文档记录
