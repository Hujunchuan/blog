# Connector 规范

## 目标

为不同知识源提供统一读取接口，避免前端或同步层直接依赖具体来源。

## 第一阶段支持

- `local`: 本地目录

当前状态：

- 已支持通过 `apps/web/knowledge-sources.json` 配置多个 `local` 知识源
- 已通过 connector factory 统一创建 connector

## 后续扩展

- `github`: GitHub 仓库
- `server`: 远程服务器目录

## 统一接口

```ts
interface KnowledgeConnector {
  getSource(): Promise<KnowledgeSource>
  listDocuments(): Promise<SourceDocument[]>
  readDocument(relativePath: string): Promise<string>
}
```

## SourceDocument 最小字段

- `relativePath`
- `absolutePath`
- `updatedAt`

## Local Connector 要求

- 递归扫描目录
- 只读取 `.md` 与 `.mdx`
- 支持忽略规则
- 稳定产出相对路径

当前实现补充：

- 支持 `settings.ignorePatterns`
- 当前忽略目录名为简单目录名匹配，不支持复杂 glob

## GitHub Connector 方向

- 使用 GitHub API 或本地镜像仓库
- 支持分支配置
- 支持 webhook 或定时拉取

## Server Connector 方向

- 支持 SSH/SFTP
- 支持挂载目录
- 后续考虑 rsync/agent 模式

## 错误处理

- 单文件读取失败不应拖垮整个知识源
- 连接器应提供可诊断错误
- 同步层需要记录失败文件路径
