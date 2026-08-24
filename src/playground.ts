/**
 * `@liminis/diagrams/playground` — a ready-made C4 editing surface.
 *
 * A React component with a source pane, a live draggable diagram, zoom, and an
 * expand-to-lightbox affordance. This is the shell this package's own
 * documentation uses; it lives here because five documentation sites were
 * keeping identical copies of it, and they drifted the moment the renderer
 * gained a feature.
 *
 * Requires `@liminis/diagrams/playground.css`, imported separately — bundlers
 * differ too much about CSS-in-package for importing it from here to be safe.
 *
 * React and react-dom are optional peer dependencies, as they are for `./react`.
 * Nothing in `./core` reaches this file.
 */

export { default as C4Playground } from './playground/C4Playground';
export type { C4PlaygroundProps } from './playground/C4Playground';

/**
 * Tracks a host that follows the `data-theme="dark"|"light"` convention, falling
 * back to `prefers-color-scheme`. Entirely optional: `C4Playground` takes
 * `isDarkMode` as a prop, and a host with its own theming should pass its own
 * answer rather than use this.
 */
export { useIsDarkMode } from './playground/useIsDarkMode';
