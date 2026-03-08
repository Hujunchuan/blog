# 解析规范

## 输入

- Markdown 文件内容
- 文档路径
- 文档基础元信息

## 输出

统一文档模型：

- `title`
- `slug`
- `content`
- `summary`
- `tags`
- `links`
- `headings`

## 标题提取优先级

1. frontmatter `title`
2. 第一行 `# Heading`
3. 文件名

## 标签提取规则

1. frontmatter `tags`
2. 正文内 `#标签`

## 链接提取规则

需要兼容：

- `[[wikilink]]`
- `[text](relative-path.md)`
- `[text](absolute-or-http-url)` 仅作为外链记录，不作为内部图谱边

## 摘要生成规则

- 先移除 frontmatter
- 再做基础 Markdown 降噪
- 截取前 240-320 字

## 容错原则

- frontmatter 异常时跳过元数据，不中断整库处理
- 日期异常时不阻塞解析
- 链接无法解析时保留 `rawTarget`
