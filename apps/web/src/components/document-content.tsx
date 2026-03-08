function renderBlock(block: string, index: number) {
  const trimmed = block.trim()
  if (!trimmed) return null

  if (trimmed.startsWith("### ")) return <h3 key={index}>{trimmed.slice(4)}</h3>
  if (trimmed.startsWith("## ")) return <h2 key={index}>{trimmed.slice(3)}</h2>
  if (trimmed.startsWith("# ")) return <h1 key={index}>{trimmed.slice(2)}</h1>

  if (trimmed.startsWith("- ")) {
    const items = trimmed
      .split("\n")
      .map((line) => line.replace(/^- /, "").trim())
      .filter(Boolean)

    return (
      <ul key={index}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  return <p key={index}>{trimmed}</p>
}

export function DocumentContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/g)
  return <div className="document-content">{blocks.map((block, index) => renderBlock(block, index))}</div>
}
