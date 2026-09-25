// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://mockscores.org',
  output: 'static',

  integrations: [
    sitemap(),

    starlight({
      title: 'MockScores Documentation',
      description:
          'Help using MockScores to run mock trial tournaments.',

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