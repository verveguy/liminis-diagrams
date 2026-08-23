/**
 * `@liminis/diagrams` — C4 architecture diagrams: parse, layout, render.
 *
 * The default entry re-exports `./core`, which is React-free. Rendering lives
 * behind `@liminis/diagrams/react` (components) and `@liminis/diagrams/server`
 * (source-to-SVG in one call) so that importing this package does not imply a
 * React dependency.
 */

export * from './core';
