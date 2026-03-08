import Link from "next/link"
import { ExplorerNode } from "@repo/core/types"

interface ExplorerTreeProps {
  sourceId: string
  nodes: ExplorerNode[]
}

function ExplorerBranch({ sourceId, node }: { sourceId: string; node: ExplorerNode }) {
  if (!node.isFolder) {
    return (
      <li>
        <Link href={`/source/${sourceId}/doc/${node.slug}`}>{node.name}</Link>
      </li>
    )
  }

  return (
    <li>
      <details open>
        <summary>{node.name}</summary>
        {node.children && node.children.length > 0 && (
          <ul>
            {node.children.map((child) => (
              <ExplorerBranch key={child.id} sourceId={sourceId} node={child} />
            ))}
          </ul>
        )}
      </details>
    </li>
  )
}

export function ExplorerTree({ sourceId, nodes }: ExplorerTreeProps) {
  return (
    <nav className="panel explorer-panel">
      <div className="panel-header">
        <h2>Explorer</h2>
        <p>按目录浏览知识源内容。</p>
      </div>
      <ul className="explorer-list">
        {nodes.map((node) => (
          <ExplorerBranch key={node.id} sourceId={sourceId} node={node} />
        ))}
      </ul>
    </nav>
  )
}
