import { BookOpen, Menu } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { docsNavigation } from '../data/content'

type TocItem = { id: string; label: string }

type DocsLayoutProps = {
  children: ReactNode
  toc?: TocItem[]
}

export function DocsLayout({ children, toc = [] }: DocsLayoutProps) {
  return (
    <div className="container docs-layout">
      <aside className="docs-sidebar" aria-label="Documentation navigation">
        <NavLink className="docs-sidebar__home" to="/docs">
          <BookOpen size={18} aria-hidden="true" /> Documentation
        </NavLink>
        <details className="docs-mobile-index">
          <summary><Menu size={18} /> Browse documentation</summary>
          <nav>
            {docsNavigation.map((item) => (
              <NavLink key={item.slug} to={`/docs/${item.slug}`}>{item.label}</NavLink>
            ))}
          </nav>
        </details>
        <nav className="docs-desktop-index">
          <p>Guides</p>
          {docsNavigation.map((item) => (
            <NavLink key={item.slug} to={`/docs/${item.slug}`}>{item.label}</NavLink>
          ))}
        </nav>
        <div className="docs-sidebar__support">
          <span>Need more help?</span>
          <NavLink to="/contact">Contact Zentel Insight</NavLink>
        </div>
      </aside>
      <article className="docs-article">{children}</article>
      {toc.length ? (
        <aside className="docs-toc" aria-label="On this page">
          <p>On this page</p>
          <nav>{toc.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}</nav>
        </aside>
      ) : null}
    </div>
  )
}
