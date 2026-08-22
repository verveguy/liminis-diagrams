/**
 * `@liminis/diagrams/server` — one-call source-to-SVG rendering.
 *
 * DOM-free, so it runs in Node, an Electron main process, or CI — but it drives
 * the React renderer through `react-dom/server`, so the `react` and `react-dom`
 * optional peers must be installed. It is not part of `/core` for that reason
 * alone; see docs/EXTRACTION-PLAN.md §2.
 */

export { renderC4DiagramToSVG } from './server/render-to-string';
