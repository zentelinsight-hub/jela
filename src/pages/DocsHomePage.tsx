import { ArrowRight, BookOpen, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DocsLayout } from '../components/DocsLayout'
import { Seo } from '../components/Seo'
import { docsNavigation } from '../data/content'

export default function DocsHomePage() {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return docsNavigation
    return docsNavigation.filter((item) => `${item.label} ${item.summary}`.toLowerCase().includes(normalized))
  }, [query])

  return (
    <main className="docs-page">
      <Seo
        title="Documentation"
        description="Read the official Jela AI documentation for getting started, security, files, plans, credits, privacy and responsible use."
        path="/docs"
      />
      <DocsLayout>
        <div className="docs-hero">
          <p className="eyebrow">Jela AI documentation</p>
          <h1>Clear guidance from the start.</h1>
          <p>Learn what Jela AI is, how the Android experience is intended to work and where to find reliable product information.</p>
          <label className="docs-search">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">Search documentation topics</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation topics" />
          </label>
        </div>

        <div className="docs-cards">
          {filtered.map((item, index) => (
            <Link key={item.slug} to={`/docs/${item.slug}`} className="docs-card">
              <div><BookOpen size={19} /><span>{String(index + 1).padStart(2, '0')}</span></div>
              <h2>{item.label}</h2>
              <p>{item.summary}</p>
              <span className="docs-card__link">Read guide <ArrowRight size={16} /></span>
            </Link>
          ))}
        </div>
        {!filtered.length ? <p className="docs-no-results">No guide matches that search. Try a broader topic.</p> : null}
      </DocsLayout>
    </main>
  )
}
