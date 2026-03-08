# 开发与部署

## 本地开发

### 1. 启动动态站点

```bash
npm run web:dev
```

默认端口：

- 动态站点：`http://localhost:3002`

### 2. 启动 PostgreSQL

```bash
npm run db:up
```

### 3. 初始化数据库

```bash
npm run db:init:web
```

### 4. 持久化默认知识源

```bash
npm run db:persist:default
```

完成后，首页概览、搜索、文档页、Explorer 和图谱接口会优先读取 PostgreSQL。

## 当前运行模式

### 无数据库模式

- 只启动 `web:dev`
- 页面全部走内存快照

### 数据库增强模式

- 启动 PostgreSQL
- 初始化 schema
- 执行 persist
- 页面优先读库，失败时自动回退

## 环境变量

`apps/web/.env.local`

- `KNOWLEDGE_SOURCES_FILE`
- `KNOWLEDGE_CACHE_TTL_MS`
- `DATABASE_URL`
- `PGSSL`

## 生产部署建议

当前仍建议先按单机部署：

1. Next.js 应用
2. PostgreSQL
3. 定时或事件触发的同步任务

后续再拆分为：

1. Web
2. Sync Worker
3. PostgreSQL
4. Redis / Queue

## 当前不包含

- 自动 watcher 同步
- 多实例并发同步控制
- 正式生产数据库迁移系统
