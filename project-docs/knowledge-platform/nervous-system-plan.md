# Nervous System 升级方案

## 背景

当前系统已经具备：

- 多知识源接入骨架
- 文档持久化
- Explorer
- 搜索
- 基于文档链接的简化图谱

这套能力足够展示知识库，但还不够支撑后续的“知识工程”目标。当前图谱仍然主要回答：

- 哪篇文档链接到了哪篇文档
- 哪个目录下有哪些文档

它还不能稳定回答更高阶的问题，例如：

- 某个概念关联了哪些讨论、人物、项目和任务
- 某个决策是从哪些证据链里形成的
- 某条实践路径由哪些步骤组成
- 某个知识点变化后，会影响哪些文档和流程

因此，这次升级不直接照搬 GitNexus，而是吸收其 `nervous system` 思路，建设一层适合知识库场景的“知识神经系统”。

## 本次升级的目标

1. 在现有文档层之上，增加实体层和关系层。
2. 让图谱从“文档链接图”升级为“知识结构图”。
3. 为后续的 AI 检索、影响分析、流程追踪和多源聚合提供统一索引层。

## 非目标

本轮不做：

- 全量替换现有 Explorer / Search / Graph 的读链路
- 引入图数据库
- 完成 AI agent / MCP 接口
- 一次性完成所有实体抽取与关系抽取

## 关键改动

### 1. 数据模型升级

在现有 `sources / documents / sync_runs` 之外，增加：

- `entities`
- `relations`

这两个表是 nervous system 的最小落点。

### 2. 抽取流程升级

同步流程不再只解析文档本身，还会逐步增加：

- 文档中的实体识别
- 文档中的关系识别
- 基于规则和后续模型的结构化抽取

### 3. API 升级

后续新增的 API 将不再只返回文档列表和文档图谱，还会返回：

- related nodes
- impact analysis
- evidence chain
- process trace
- cluster context

### 4. UI 升级

前端图谱不会只画文档节点，还会支持：

- 概念节点
- 人物节点
- 项目节点
- 决策节点
- 任务节点

## 推荐的分阶段落地方式

### Phase A: 基础模型落地

目标：

- 定义 `KnowledgeEntity` 和 `KnowledgeRelation`
- 在 PostgreSQL 中增加 `entities` 和 `relations` 基础表
- 不改现有站点读路径

收益：

- 风险最低
- 给后续抽取和查询提供稳定落点

### Phase B: 最小抽取器

目标：

- 从 `documents.tags`
- 从显式双链
- 从标题与路径规则

抽取第一批实体和关系。

建议先支持的实体类型：

- `document`
- `concept`
- `person`
- `project`
- `meeting`
- `tag`

建议先支持的关系类型：

- `mentions`
- `references`
- `belongs_to`
- `related_to`

### Phase C: 查询接口

新增：

- `GET /api/source/[sourceId]/related`
- `GET /api/source/[sourceId]/impact`
- `GET /api/source/[sourceId]/evidence`

目标是先把“知识相关节点”和“证据链”查起来。

### Phase D: Nervous System UI

在现有图谱页之外，增加一个更高阶的知识视图：

- 节点类型过滤
- 关系类型过滤
- 证据文档联动
- 局部影响分析

### Phase E: Agent / MCP 工具层

为后续 AI 能力准备工具接口：

- `search_knowledge`
- `find_related_nodes`
- `analyze_impact`
- `trace_process`

## 当前这一轮的实际范围

本轮先做三件事：

1. 输出 nervous system 升级文档
2. 在代码里落下最小基础模型：
   - core types
   - PostgreSQL schema
3. 将第一版 `tags / links` 抽取结果写入 `entities / relations`

这意味着：

- 现有网站功能保持不变
- 数据库已经为下一阶段做好准备
- 第一版结构化关系已经开始落库
- `related` 查询 API 已经可用
- `impact` 查询 API 已经可用
- 下一轮可以直接开始做 `evidence` 查询

## 进入下一轮开发时的优先级

1. 提供 `evidence` 查询 API
2. 在图谱页增加“知识节点模式”
3. 为 `related / impact` 增加前端入口
4. 扩展更多实体类型的抽取规则
