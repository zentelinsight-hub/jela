import { useEffect } from 'react'
import { canonicalUrl, IS_PREVIEW_DEPLOYMENT, SOCIAL_IMAGE_URL } from '../lib/seo'

type SeoProps = {
  title: string
  description: string
  path: string
  noIndex?: boolean
  structuredData?: Record<string, unknown> | null
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

export function Seo({ title, description, path, noIndex = false, structuredData = null }: SeoProps) {
  useEffect(() => {
    const fullTitle = title === 'Jela AI' ? title : `${title} | Jela AI`
    const pageUrl = canonicalUrl(path)
    const shouldNoIndex = noIndex || IS_PREVIEW_DEPLOYMENT
    document.title = fullTitle
    setMeta('description', description)
    setMeta('robots', shouldNoIndex ? 'noindex, nofollow, noarchive' : 'index, follow')
    setMeta('og:title', fullTitle, true)
    setMeta('og:description', description, true)
    setMeta('og:type', 'website', true)
    setMeta('og:site_name', 'Jela AI', true)
    setMeta('og:url', pageUrl, true)
    setMeta('og:image', SOCIAL_IMAGE_URL, true)
    setMeta('og:image:alt', 'Jela AI — intelligence that helps you move forward', true)
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', description)
    setMeta('twitter:image', SOCIAL_IMAGE_URL)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = pageUrl

    const scriptId = 'jela-page-structured-data'
    document.getElementById(scriptId)?.remove()
    if (structuredData) {
      const script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(structuredData)
      document.head.appendChild(script)
    }
    return () => document.getElementById(scriptId)?.remove()
  }, [description, noIndex, path, structuredData, title])

  return null
}
