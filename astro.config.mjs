import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import site from './site.config.mjs';
import { remarkFmc } from './src/lib/remark-fmc.mjs';

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.includes('/admin/') })],
  // Skripte immer als eigene Dateien ausliefern (nötig für die Content-Security-Policy)
  vite: { build: { assetsInlineLimit: 0 } },
  image: { layout: 'constrained', responsiveStyles: true },
  markdown: { processor: unified({ remarkPlugins: [remarkFmc], smartypants: false }) },
});
