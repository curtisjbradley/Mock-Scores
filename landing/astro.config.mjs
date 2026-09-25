// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import starlight from '@astrojs/starlight';

// `site` is required for SEO: it sets the absolute base URL used for the
// generated sitemap and for canonical/Open Graph URLs in the layout.
// Point this at the marketing subdomain you want search engines to rank.
export default defineConfig({
  site: 'https://mockscores.org',
  // Static HTML output — fully pre-rendered pages, ideal for crawlability
  // and Core Web Vitals. No client JS is shipped unless a component opts in.
  output: 'static',
  integrations: [sitemap(), starlight({
    title: 'MockScores Documentation',
    description: "Help using MockScores to run mock trial tournaments.",
    sidebar:  [{ slug: "docs", label: "Overview" },
      { slug: "docs/getting-started" },
      { slug: "docs/managing-your-account" },
      {
        label: "Organizers",
        items: [
          { autogenerate: { directory: "docs/organizer" } },
        ],
      },
      {
        label: "Coaches",
        items: [
          { autogenerate: { directory: "docs/coach" } },
        ],
      },
      {
        label: "Scorers",
        items: [
          { autogenerate: { directory: "docs/scorer" } },
        ],
      },
    ],
    components: {
      SiteTitle: "./src/components/DocsSiteTitle.astro",
    },
    lastUpdated: true
  })],
});