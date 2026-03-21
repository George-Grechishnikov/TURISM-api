import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** В собранном index.html видно номер сборки (проверка в DevTools → Elements → &lt;head&gt;) */
function turizmBuildMeta() {
  const id = process.env.VITE_APP_BUILD_ID || 'dev'
  return {
    name: 'turizm-build-meta',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta name="turizm-build" content="${String(id).replace(/"/g, '')}" />`,
      )
    },
  }
}

/** См. main.jsx: при загрузке SPA запрашивается /build.json без кэша — сверка с бандлом, при необходимости reload */
function turizmBuildJson() {
  return {
    name: 'turizm-build-json',
    closeBundle() {
      const id = process.env.VITE_APP_BUILD_ID || 'dev'
      const out = path.resolve(__dirname, 'dist/build.json')
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, `${JSON.stringify({ buildId: String(id) })}\n`, 'utf8')
    },
  }
}

export default defineConfig({
  plugins: [react(), turizmBuildMeta(), turizmBuildJson()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
