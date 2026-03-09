import "./globals.css"
import Link from "next/link"
import { ReactNode } from "react"

export const metadata = {
  title: "止观AI",
  description: "面向多知识源整合、动态图谱和持续演进的止观AI知识平台。",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <header className="site-header">
            <div className="site-header-row">
              <div>
                <Link href="/" className="brand">
                  止观AI
                </Link>
                <p className="brand-subtitle">多知识源、动态图谱、面向后续统一索引的知识平台原型</p>
              </div>
              <nav className="site-nav">
                <Link href="/">首页</Link>
                <Link href="/admin">管理台</Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
