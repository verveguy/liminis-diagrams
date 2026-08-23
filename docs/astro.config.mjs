// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'

// Served as a GitHub Pages project site. The account has a custom domain on the
// user site, so this resolves to https://v3rv.com/liminis-diagrams/ rather than
// verveguy.github.io — the subpath is the same either way.
//
// The demo is a separate Vite app built with base '/liminis-diagrams/demo/' and
// copied into this site's output by .github/workflows/pages.yml. Nothing here
// builds it, and Astro cannot see it, so links to it are external as far as the
// link checker is concerned.
export default defineConfig({
  site: 'https://v3rv.com',
  base: '/liminis-diagrams',
  // React is here for embedded applets: a live C4 editor on the page that
  // explains it. Astro ships static HTML and hydrates only components marked
  // with a client directive, so a page carrying several playgrounds does not
  // pay for all of them up front — use `client:visible` rather than
  // `client:load` unless an applet must be interactive above the fold.
  integrations: [
    react(),
    starlight({
      customCss: ['./src/styles/playground.css'],
      title: '@liminis/diagrams',
      description:
        'C4 architecture diagrams for JavaScript: parse C4-PlantUML, lay out with dagre, render to SVG.',
      social: { github: 'https://github.com/verveguy/liminis-diagrams' },
      editLink: {
        baseUrl: 'https://github.com/verveguy/liminis-diagrams/edit/main/docs/',
      },
      sidebar: [
        {
          label: 'Building on this package',
          items: [
            { label: 'Overview', link: '/' },
            { label: 'Playground', link: '/playground/' },
            { label: 'Architecture', link: '/architecture/' },
            { label: 'C4-PlantUML reference', link: '/dsl-reference/' },
            { label: 'Data model', link: '/data-model/' },
            { label: 'Recipes', link: '/recipes/' },
          ],
        },
        {
          // The extraction record is a decision log, not user documentation. It
          // is on the site because its §6 is the honest account of what this
          // package does not do — which the guide links to — but filed apart so
          // nobody mistakes it for a how-to.
          label: 'Project',
          items: [{ label: 'Extraction record', link: '/extraction-plan/' }],
        },
      ],
    }),
  ],
})
