import { useEffect } from 'react'

type SeoProps = {
  title: string
  description: string
  path: string
}

function setMeta(name: string, content: string, property = false) {
  const attribute = property ? 'property' : 'name'
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }
  element.content = content
}

export function Seo({ title, description, path }: SeoProps) {
  useEffect(() => {
    const fullTitle = title === 'Jela AI' ? title : `${title} | Jela AI`
    const canonicalUrl = new URL(path, window.location.origin).toString()
    document.title = fullTitle
    setMeta('description', description)
    setMeta('og:title', fullTitle, true)
    setMeta('og:description', description, true)
    setMeta('og:type', 'website', true)
    setMeta('og:url', canonicalUrl, true)
    setMeta('twitter:card', 'summary')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', description)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl
  }, [description, path, title])

  return null
}
