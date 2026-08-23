# `@liminis/diagrams` documentation

This is documentation for someone building a tool *on top of* `@liminis/diagrams` —
a CLI, a CI job, a wiki, a different editor. It answers the questions the top-level
[`README.md`](../README.md) quick start doesn't: what the layout result contains, how
manual positions interact with dagre, what the parser accepts and silently discards,
and which parts of a "C4 editing experience" live here versus in
[`@liminis/editor`](https://github.com/verveguy/liminis-editor).

If you want the story of *how* this package came to exist — what was extracted from
`@liminis/editor`, what the move preserved, what it decided not to bring along — see
[`EXTRACTION-PLAN.md`](./EXTRACTION-PLAN.md) instead. This directory is for using the
package; that file is for its history.

## Limitations — read this first

The most expensive mistake a tool builder can make against this package is invisible
until you've already built against it. Four things this package does **not** do:

1. **No editing affordance.** There is no textarea overlay, no click-to-edit, no
   layout-mode toolbar, no dark-mode auto-detection. Those are all Lexical-bound and
   stayed behind in `@liminis/editor` (`C4Component.tsx`). This package gives you
   *render* and *drag* — a host still needs its own "edit the source text" surface.
2. **No persistence.** `@liminis/diagrams` never writes anywhere. `C4InteractiveRenderer`
   reports position changes via a callback; storing them — in a file, a database, a
   fenced code block's meta string, wherever — is entirely the host's job. See
   [Recipe 3](./recipes.md#recipe-3-position-persistence--the-hosts-choice).
3. **Element IDs are fence-local.** `C4Element.id` is unique within one parsed diagram
   only. It carries no identity across two diagrams — two `System(app, ...)` blocks in
   different files have nothing connecting their `app` IDs. See
   [EXTRACTION-PLAN.md §6b](./EXTRACTION-PLAN.md#6-what-the-extraction-does-not-give-you).
4. **No cross-diagram link syntax.** There is no `Rel` that spans two diagrams, and no
   "this container is detailed in another diagram" relationship. You can't improvise one
   either: an unrecognized macro name is a parse error, not a silently-ignored no-op, and
   `!include` is recognized but stripped — the included file is never fetched or inlined.
   See
   [EXTRACTION-PLAN.md §6c](./EXTRACTION-PLAN.md#6-what-the-extraction-does-not-give-you).

## Contents

| Doc | Answers |
|---|---|
| [`architecture.md`](./architecture.md) | Which entry point (`.`, `./core`, `./react`, `./server`) should I install, and why? |
| [`dsl-reference.md`](./dsl-reference.md) | Will my existing C4-PlantUML source parse? What gets silently stripped? |
| [`data-model.md`](./data-model.md) | What does a parsed diagram / layout result actually contain? (the centerpiece) |
| [`recipes.md`](./recipes.md) | Complete, runnable examples: headless SVG rendering, embedding the interactive renderer, persisting positions. |
| [`github-integration.md`](./github-integration.md) | How do I get GitHub to show a rendered C4 diagram in a markdown file? |
| [`claude-code-integration.md`](./claude-code-integration.md) | How do I get Claude to render a real C4 diagram instead of hand-drawing one? |
