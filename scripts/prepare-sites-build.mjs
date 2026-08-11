import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const serverDirectory = resolve('dist/server')
const workerEntry = resolve(serverDirectory, 'index.js')

const workerSource = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404 || !['GET', 'HEAD'].includes(request.method)) {
      return response
    }

    const url = new URL(request.url)
    const lastSegment = url.pathname.split('/').pop() || ''
    if (lastSegment.includes('.')) {
      return response
    }

    const indexRequest = new Request(new URL('/index.html', url), request)
    return env.ASSETS.fetch(indexRequest)
  },
}
`

await mkdir(serverDirectory, { recursive: true })
await writeFile(workerEntry, workerSource, 'utf8')
