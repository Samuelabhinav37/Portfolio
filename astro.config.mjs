import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import rehypeTemplateClasses from './src/plugins/rehype-template-classes.mjs';

export default defineConfig({
  // Canonical URLs, og:url and share links all derive from this one value.
  site: 'https://samuelabhinav.com',
  integrations: [mdx()],
  // ClientRouter page changes: fetch a page while its link is hovered (about 200ms
  // head start). The router's fetch reuses it; Chrome's Speculation-Rules prefetch
  // could not be, since it only serves full page loads.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Each page's CSS (~30 KB) goes into its HTML instead of 4-5 separate files
  // that held up the first paint (Lighthouse: ~600ms of render-blocking
  // requests). CSP allows it: style-src keeps 'unsafe-inline' (functions/_middleware.js).
  build: { inlineStylesheets: 'always' },
  markdown: {
    // css-variables theme lets blog.css own the code palette
    // (green strings, grey keywords) instead of a stock Shiki theme.
    shikiConfig: { theme: 'css-variables' },
    processor: unified({ rehypePlugins: [rehypeTemplateClasses] }),
  },
  vite: {
    optimizeDeps: {
      // "three" is loaded in-browser from a CDN via a native <script type="importmap">
      // (see src/pages/index.astro) — it's never an npm dependency. Without this,
      // Vite's dev-server dependency scanner statically finds the bare `import('three')`
      // and tries to resolve it from node_modules, failing dev startup.
      exclude: ['three'],
    },
  },
});
