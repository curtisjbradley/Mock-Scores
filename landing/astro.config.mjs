// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://mockscores.org',
  output: 'static',

  integrations: [
    sitemap(),
    react(),

    starlight({
      title: 'MockScores Documentation',
      description:
          'Help using MockScores to run mock trial tournaments.',
      disable404Route: true,

      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:type', content: 'website' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:site_name', content: 'MockScores' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:url', content: 'https://mockscores.org/docs/' },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:title',
            content: 'MockScores Documentation',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:description',
            content: 'Help using MockScores to run mock trial tournaments.',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://mockscores.org/og-default.png',
          },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:width', content: '1200' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:height', content: '630' },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:alt',
            content:
              'MockScores — scoring and tabulation software for mock trial tournaments',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:title',
            content: 'MockScores Documentation',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:description',
            content: 'Help using MockScores to run mock trial tournaments.',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:image',
            content: 'https://mockscores.org/og-default.png',
          },
        },
      ],

      sidebar: [
        {
          label: 'Start Here',
          items: [
            {
              slug: 'docs',
              label: 'Overview',
            },
            {
              slug: 'docs/getting-started',
              label: 'Getting Started',
            },
            {
              slug: 'docs/managing-your-account',
              label: 'Managing Your Account',
            },
            {
              slug: 'docs/faq',
              label: 'FAQ',
            },
            {
              slug: 'docs/glossary',
              label: 'Glossary',
            },
          ],
        },

        {
          label: 'Organizers',
          collapsed: true,
          items: [
            {
              autogenerate: {
                directory: 'docs/organizer',
                collapsed: true,
              },
            },
          ],
        },

        {
          label: 'Coaches',
          collapsed: true,
          items: [
            {
              autogenerate: {
                directory: 'docs/coach',
                collapsed: true,
              },
            },
          ],
        },

        {
          label: 'Scorers',
          collapsed: true,
          items: [
            {
              autogenerate: {
                directory: 'docs/scorer',
                collapsed: true,
              },
            },
          ],
        },

        {
          label: 'MockScores Home',
          link: '/',
          attrs: {
            class: 'back-to-home-btn',
            'aria-label': 'Return to the MockScores website',
          },
        },
      ],

      components: {
        SiteTitle: './src/components/DocsSiteTitle.astro',
      },

      customCss: ['./src/styles/starlight.css'],
      lastUpdated: true,
    }),
  ],
});