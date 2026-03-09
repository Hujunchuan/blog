# Connector 规范

## 目标

为不同知识源提供统一读取接口，避免前端或同步层直接依赖具体来源。

## 当前支持

- `local`: 本地目录
- `github`: GitHub 仓库第一版

当前状态：

- `local` 已稳定用于当前动态站点
- `github` 已支持 public repo 读取，并预留 private repo token 配置
- `server` 仍未实现

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

## Local Connector

要求：

- 递归扫描目录
- 只读取 `.md` / `.mdx`
- 支持 `settings.ignorePatterns`
- 输出稳定的 POSIX 相对路径

说明：

- 当前忽略规则仍以目录名为主
- 暂不支持复杂 glob

## GitHub Connector 第一版

### 支持范围

- public repo
- `owner/repo`
- `https://github.com/owner/repo`
- `git@github.com:owner/repo.git`
- 可选指定分支
- 可选通过环境变量注入 token

### 实现方式

- 首次读取时在本地创建 mirror
- 默认缓存到 `apps/web/.cache/github-sources/<sourceId>`
- 后续读取会复用 mirror，并在一定 TTL 内避免重复拉取
- 同样只扫描 `.md` / `.mdx`

### 推荐配置

```json
{
  "id": "daceng-wisdom-repo",
  "name": "大成智慧仓库",
  "type": "github",
  "location": "owner/repo",
  "enabled": true,
  "description": "GitHub 知识源第一版示例",
  "settings": {
    "ignorePatterns": [".github"],
    "github": {
      "branch": "main",
      "tokenEnv": "GITHUB_TOKEN",
      "cacheDir": "apps/web/.cache/github-sources/daceng-wisdom-repo"
    }
  }
}
```

### 约束

- 第一版仍以“拉取整个 repo mirror”方式工作
- 还没有 webhook
- 还没有增量文件级同步
- private repo 依赖 `tokenEnv`

## Server Connector 方向

- SSH / SFTP
- 挂载目录
- 后续考虑 rsync / agent 模式

## 错误处理

- 单个文件解析失败不应拖垮整个知识源
- connector 应输出可诊断错误
- 同步层记录失败源和失败轮次
