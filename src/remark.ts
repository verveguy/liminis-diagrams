/**
 * `@liminis/diagrams/remark` — turn ```c4 fences into live diagram islands.
 *
 * A build-time remark plugin. It rewrites each fenced `c4` block into a JSX
 * element and injects one import per file, so a markdown page reads as markdown
 * on GitHub and renders as an interactive diagram on a site.
 *
 * It also strips the generated `<picture>` blocks that sit beside those fences
 * for GitHub's benefit: on a site the island renders the same diagram, so
 * showing both would be duplication.
 *
 *     import { remarkC4 } from '@liminis/diagrams/remark'
 *     export default defineConfig({ markdown: { remarkPlugins: [remarkC4] } })
 *
 * Nothing here imports React, or anything at all beyond the language: it runs
 * in Node during a build, and the package's single runtime dependency is unchanged.
 */

export { remarkC4, remarkC4 as default } from './remark/remark-c4';
export type { RemarkC4Options, MdastNode } from './remark/remark-c4';
