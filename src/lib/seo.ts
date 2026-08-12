export const CANONICAL_SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.jelaai.com.ng').replace(/\/$/, '')
export const SOCIAL_IMAGE_URL = `${CANONICAL_SITE_URL}/social-card.png`
export const IS_PREVIEW_DEPLOYMENT = import.meta.env.VITE_DEPLOY_ENV !== 'production'

export function canonicalUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${CANONICAL_SITE_URL}${normalized}`
}
