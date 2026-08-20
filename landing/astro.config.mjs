// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// `site` is required for SEO: it sets the absolute base URL used for the
// generated sitemap and for canonical/Open Graph URLs in the layout.
// Point this at the marketing subdomain you want search engines to rank.
export default defineConfig({
  site: 'https://www.mockscores.org',
  // Static HTML output — fully pre-rendered pages, ideal for crawlability
  // and Core Web Vitals. No client JS is shipped unless a component opts in.
  output: 'static',
  integrations: [sitemap()],
});
