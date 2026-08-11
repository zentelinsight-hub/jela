import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function deploymentMeta(deployEnvironment: string): Plugin {
  return {
    name: 'jela-deployment-meta',
    transformIndexHtml() {
      const tags = [{
        tag: 'meta',
        attrs: { name: 'robots', content: deployEnvironment === 'production' ? 'index, follow' : 'noindex, nofollow, noarchive' },
        injectTo: 'head' as const,
      }]
      const verification = process.env.VITE_GOOGLE_SITE_VERIFICATION
      if (verification) tags.push({ tag: 'meta', attrs: { name: 'google-site-verification', content: verification }, injectTo: 'head' as const })
      return tags
    },
  }
}

export default defineConfig(({ mode }) => {
  const deployEnvironment = process.env.VERCEL_ENV ?? process.env.VITE_DEPLOY_ENV ?? (mode === 'production' ? 'production' : 'development')
  return {
    plugins: [react(), deploymentMeta(deployEnvironment)],
    define: { 'import.meta.env.VITE_DEPLOY_ENV': JSON.stringify(deployEnvironment) },
  }
})
