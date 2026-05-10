import { defineConfig, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// Inline CSS assets directly into index.html at build time.
// Small stylesheets are cheaper to parse inline than to fetch as a
// render-blocking request, and Vite hashes the CSS filename per build
// so the caching benefit of a separate file is negligible.
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html
      return html.replace(
        /<link[^>]*rel="stylesheet"[^>]*href="\/([^"]+\.css)"[^>]*>/g,
        (match, file: string) => {
          const asset = ctx.bundle![file]
          if (asset && asset.type === 'asset') {
            const source =
              typeof asset.source === 'string'
                ? asset.source
                : Buffer.from(asset.source).toString('utf8')
            return `<style>${source}</style>`
          }
          return match
        },
      )
    },
    // Drop now-unused CSS asset from the bundle so it isn't emitted to dist.
    generateBundle(_options, bundle) {
      const htmlFiles = Object.values(bundle).filter(
        (c) => c.type === 'asset' && c.fileName.endsWith('.html'),
      )
      const referenced = new Set<string>()
      for (const html of htmlFiles) {
        if (html.type !== 'asset') continue
        const src =
          typeof html.source === 'string'
            ? html.source
            : Buffer.from(html.source).toString('utf8')
        for (const match of src.matchAll(/href="\/([^"]+\.css)"/g)) {
          referenced.add(match[1])
        }
      }
      for (const [key, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && chunk.fileName.endsWith('.css') && !referenced.has(chunk.fileName)) {
          delete bundle[key]
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    inlineCss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Split framework vendors into their own chunks so they can
        // be parsed in parallel with the app chunk and, more importantly,
        // cached independently of app-code deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run[\\/]router)[\\/]/.test(id)) {
            return 'router'
          }
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'react'
          }
        },
      },
    },
  },
})
