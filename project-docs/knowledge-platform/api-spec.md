# API 设计

## 目标

- 前端不直接访问文件系统
- 所有数据通过统一服务层和 API 暴露
- API 结构尽量贴近未来数据库主读模型

## 公开接口

### `GET /api/health`

返回服务状态和已启用知识源数量。

### `GET /api/sources`

返回已启用知识源列表。

### `GET /api/source/:sourceId/overview`

返回知识源概览：

- `documentCount`
- `folderCount`
- `tagCount`
- `linkCount`
- `recentDocuments`
- `topTags`
- `densestDocuments`

当前实现：

- 优先读 PostgreSQL
- 若数据库不可用或该知识源未持久化，则回退到内存快照

### `GET /api/source/:sourceId/explorer`

返回目录树。

当前实现：

- 优先读 PostgreSQL
- 若数据库不可用或该知识源未持久化，则回退到内存快照

### `GET /api/source/:sourceId/search?q=...`

返回搜索结果。

当前实现：

- 优先读 PostgreSQL
- 若数据库不可用或该知识源未持久化，则回退到内存快照

### `GET /api/source/:sourceId/graph`

返回图谱节点和边。

当前实现：

- 优先读 PostgreSQL
- 若数据库不可用或该知识源未持久化，则回退到内存快照

### `GET /api/source/:sourceId/related?slug=...`

返回某个节点的相邻知识关系。

当前支持：

- `slug`
- `entityKey`
- `limit`

返回：

- `root`
- `entities`
- `relations`

当前实现：

- 优先读 PostgreSQL 中的 `entities / relations`
- 若数据库不可用或该知识源未持久化，则回退到内存 nervous system 快照
- 当前第一版主要覆盖 `document` 与 `tag` 两类实体

## 管理接口

### `POST /api/admin/cache?sourceId=...`

使某个知识源或全部知识源的内存快照失效。

### `GET /api/admin/db/health`

检查 PostgreSQL 配置和连通性。

### `POST /api/admin/db/init`

初始化 PostgreSQL 基础 schema。

### `POST /api/admin/source/:sourceId/persist`

将当前知识源快照写入 PostgreSQL。

### `GET /api/admin/source/:sourceId/persisted-overview`

读取数据库中的概览和最近同步状态。

返回：

- `status`
- `sourceId`
- `documentCount`
- `tagCount`
- `linkCount`
- `recentDocuments`
- `topTags`
- `densestDocuments`
- `latestSyncRun`

## 未来预留

- `POST /api/admin/sync/:sourceId`
- `GET /api/admin/sync-runs`
- `POST /api/admin/sources`
- `PATCH /api/admin/sources/:sourceId`
- `GET /api/source/:sourceId/doc/:slug`
- `GET /api/source/:sourceId/impact`
- `GET /api/source/:sourceId/evidence`

## 设计原则

- API DTO 不泄露底层存储细节
- 页面层只依赖稳定结构，不依赖数据库字段名
- “数据库优先 + 快照回退” 是过渡阶段统一策略
