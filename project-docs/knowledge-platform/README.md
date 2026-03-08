# 知识平台文档索引

这套文档用于指导项目从 Quartz 静态知识站，逐步演进为可接入多知识源、支持数据库持久化和后续分布式扩展的动态知识平台。

## 当前状态

- `apps/web` 已经可以作为动态站点运行
- 已接入本地目录知识源配置 `apps/web/knowledge-sources.json`
- 已实现 `local` connector、parser、snapshot builder 和内存缓存
- 已实现 PostgreSQL 基础表结构、初始化接口、持久化接口
- 首页、概览、搜索、单篇文档、Explorer、图谱已经支持优先从 PostgreSQL 读取，失败时自动回退到内存快照
- 已新增 `/admin` 管理台，可查看数据库状态并手动触发同步
- 已新增 `npm run watch:sources`，可监听本地知识源并自动同步到 PostgreSQL

## 文档列表

- `architecture.md`: 总体架构、读写链路和模块边界
- `data-model.md`: 核心实体、表结构和索引方向
- `api-spec.md`: API 契约和当前实现状态
- `connectors.md`: 多知识源接入规范
- `parser-spec.md`: Markdown 与元数据解析规范
- `sync-pipeline.md`: 采集、解析、入库、回退链路
- `deployment.md`: 本地开发、数据库启动和运行方式
- `operations.md`: 运维与排障
- `roadmap.md`: 分阶段实施路线
- `adr/`: 关键架构决策记录

## 当前实现目录

1. `apps/web`
   动态前端和 API。
2. `packages/core`
   统一类型、接口契约和仓储抽象。
3. `packages/connectors`
   各类知识源 connector。
4. `packages/parser`
   Markdown 解析器。
5. `packages/sync`
   快照构建与同步逻辑。
6. `packages/db`
   PostgreSQL schema、持久化与查询。

## 下一步重点

1. 为 Explorer 和图谱设计更稳定的物化读模型。
2. 开始定义 GitHub connector 的最小实现。
3. 为 watcher 增加更细的增量同步策略。
