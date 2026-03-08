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
- 已支持本地 watcher 自动同步
- 已有最小管理台 `/admin`

下一步优先级：

1. 为图谱和 Explorer 设计更稳定的物化查询模型
2. 准备 GitHub connector
3. 把 watcher 从全量重建推进到增量同步

## Phase 2.5

- Nervous system 基础模型
- `entities / relations` 数据表
- 最小实体与关系抽取
- related / impact 查询 API

当前状态：

- 升级方案文档已输出
- core types 已落地
- PostgreSQL schema 已预留 `entities / relations`
- persist 已开始写入 `entities / relations`
- 第一版抽取来源为 `documents.tags` 与内部 `documents.links`
- `related` API 已落地，支持数据库优先和快照回退
- 现有页面读链路暂不切换

下一步优先级：

1. 补 `impact` 查询 API
2. 补 `evidence` 查询 API
3. 在图谱页增加知识节点模式
4. 扩展更多实体类型的抽取规则

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
