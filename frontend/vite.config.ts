import { defineConfig, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// Inline CSS assets directly into index.html at build time.
// Small stylesheets are cheaper to parse inline than to fetch as a
// render-blocking request, and Vite hashes the CSS filename per build
// so the caching benefit of a separate file is negligible.
//
// Only the CSS files actually referenced from index.html's
// <link rel="stylesheet"> tags are inlined and removed from the bundle.
// Route-level CSS (emitted alongside lazy JS chunks via cssCodeSplit)
// is left alone because it is loaded dynamically from JS, not from HTML.
function inlineCss(): Plugin {
  const inlinedFiles = new Set<string>()
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
            inlinedFiles.add(file)
            return `<style>${source}</style>`
          }
          return match
        },
      )
    },
    generateBundle(_options, bundle) {
      for (const file of inlinedFiles) {
        delete bundle[file]
      }
      inlinedFiles.clear()
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {},
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
          if (/[\\/]node_modules[\\/](blockly)[\\/]/.test(id)) {
            return 'blockly'
          }
        },
      },
    },
  },
})
