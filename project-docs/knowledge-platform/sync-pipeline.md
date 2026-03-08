# 同步流程

## 当前流程

当前系统支持两条链路：

### 1. 快照链路

1. 读取 source 配置
2. connector 扫描文档
3. parser 解析文档
4. 构建内存 snapshot
5. 页面和 API 读取 snapshot

### 2. 持久化链路

1. 读取 source 配置
2. connector 扫描文档
3. parser 解析文档
4. 构建 snapshot
5. 写入 `sources`
6. 全量替换该 source 的 `documents`
7. 基于 `tags / links` 构建 nervous system 第一版快照
8. 全量替换该 source 的 `entities / relations`
9. 写入 `sync_runs`
10. 页面和 API 优先从 PostgreSQL 回读

## 当前已实现

- 手动调用管理 API 将某个知识源 persist 到 PostgreSQL
- 在同一次 persist 中写入 `sources / documents / entities / relations / sync_runs`
- 概览、搜索、文档、Explorer、图谱支持数据库优先读取
- 数据库不可用或该 source 尚未 persist 时，自动回退到 snapshot
- `npm run watch:sources` 可监听本地知识源并自动触发 persist
- `/admin` 管理台可查看数据库状态并手动触发同步

## 删除处理

当前 persist 策略是“按 source 全量替换 documents”，因此删除文件时不需要单独写删除逻辑：

1. 新快照中不存在的文档
2. 在 `replaceDocumentsForSource` 阶段被自然清理
3. 与这些文档关联的第一版 `entities / relations`
4. 在对应的 replace 阶段被自然清理

## 失败恢复

- 失败会回滚数据库事务
- `sync_runs` 会记录 `failed`
- 站点读路径会继续回退到 snapshot，不阻塞浏览

## 当前不足

- watcher 仍是按 source 重建和全量替换，不是增量同步
- Explorer 和图谱虽然能读库，但仍是运行时投影，不是物化结构
- 还没有 webhook / GitHub 事件驱动同步
- `entities / relations` 已写库，但还没有读 API 和前端视图

## 下一阶段

1. watcher 或 webhook 发现变更
2. 触发 sync run
3. 支持增量比对
4. 只更新变化文档
5. 增加 `entities / relations` 查询接口
6. 视规模决定是否引入物化 links / graph 表
