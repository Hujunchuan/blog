# Dynamic Knowledge Platform Prototype

## 当前状态

这是面向多知识源整合的动态知识平台第一版原型。

当前已实现：

- Next.js App Router 骨架
- 本地目录 connector
- Markdown 解析与快照构建
- 首页
- 知识源页
- 文档页
- 搜索页
- 基础 API

## 默认端口

- `3002`

## 默认知识源

- `C:/Users/god89/Documents/止止观行`

可通过 `.env.local` 中的 `KNOWLEDGE_SOURCES_JSON` 覆盖。

## 推荐配置方式

- 优先编辑 `apps/web/knowledge-sources.json`
- 如需环境隔离，再通过 `KNOWLEDGE_SOURCES_JSON` 或 `KNOWLEDGE_SOURCES_FILE` 覆盖

## 数据库开发

- 本地 PostgreSQL 采用仓库根目录的 `compose.db.yml`
- 初始化：`npm run db:init:web`
- 持久化默认知识源：`npm run db:persist:default`
