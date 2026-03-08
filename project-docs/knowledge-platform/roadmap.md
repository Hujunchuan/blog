# 路线图

## Phase 1

- 本地目录 connector
- Next.js 动态站点骨架
- Explorer
- 文档页
- 搜索
- 简化图谱

当前状态：

- 已完成并可运行

## Phase 2

- PostgreSQL 接入
- 快照持久化
- 同步记录
- 数据库读路径切换

当前状态：

- `sources / documents / sync_runs` 已落地
- 已支持手动 persist 到 PostgreSQL
- 首页概览、搜索、单篇文档、Explorer、图谱已支持数据库优先读取

下一步优先级：

1. 增加 watcher 或后台同步触发
2. 为图谱和 Explorer 设计更稳定的物化查询模型
3. 准备 GitHub connector

## Phase 3

- GitHub connector
- 远程服务器 connector
- 增量同步
- 全局多源搜索

## Phase 4

- AI 摘要
- 语义搜索
- 关系抽取
- 联邦知识图谱

## Phase 5

- 权限控制
- 协作编辑
- 多租户或团队空间
