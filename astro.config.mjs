import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import rehypeTemplateClasses from './src/plugins/rehype-template-classes.mjs';

export default defineConfig({
  // Canonical URLs, og:url and share links all derive from this one value.
  site: 'https://samuelabhinav.com',
  integrations: [mdx()],
  markdown: {
    // css-variables theme lets blog.css own the code palette
    // (green strings, grey keywords) instead of a stock Shiki theme.
    shikiConfig: { theme: 'css-variables' },
    rehypePlugins: [rehypeTemplateClasses],
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
