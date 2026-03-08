import "./globals.css"
import Link from "next/link"
import { ReactNode } from "react"

export const metadata = {
  title: "知识平台原型",
  description: "面向多知识源聚合的动态知识平台原型",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <header className="site-header">
            <div>
              <Link href="/" className="brand">
                Knowledge Platform
              </Link>
              <p className="brand-subtitle">多知识源、动态读取、面向后续统一索引的知识网站骨架</p>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
