# Feature Specification: Documentation for tool builders

**Feature Branch**: `fabrik/issue-5`
**Created**: 2026-08-22
**Status**: Specified
**Input**: User description: "`@liminis/diagrams` was extracted from `@liminis/editor`, where the only consumer was one Lexical node that already knew how everything fitted together. The README is a quick start — enough to render a diagram, not enough to build on. Someone writing a different tool on top of this package currently has to read `src/` to answer basic questions: what the layout result actually contains, how manual positions interact with dagre, what the parser accepts and silently discards, and which parts of the 'C4 editing experience' live here versus which stayed behind in the editor. That last one is the most expensive to get wrong, because it is invisible until you have built against an assumption that was never true."

## Background

`@liminis/diagrams` was extracted from `@liminis/editor`, where its only consumer was a single Lexical node that already understood how the package's pieces fit together. As a result, the package's own README stayed a quick start: enough to render one diagram, not enough to build a second, independent tool on top of it.

A tool builder working outside `@liminis/editor` currently has no way to answer basic questions without reading `src/` directly:

- What does the layout result actually contain?
- How do manually-supplied positions interact with dagre's automatic layout?
- What does the C4-PlantUML parser accept, and what does it silently discard?
- Which parts of the "C4 editing experience" (textarea overlay, click-to-edit, layout toolbar, dark-mode detection, position persistence) live in this package, versus which stayed behind in `@liminis/editor`?

That last question is the most expensive to get wrong: a false assumption about it is invisible until a tool has already been built against it. This issue adds a `docs/` directory that answers all of these questions from the current, verified state of `src/`, and trims the README down to a quick start that links into it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the entry-point boundary (Priority: P1)

A tool builder deciding whether to adopt `@liminis/diagrams` for a headless (CLI/CI/server) use case needs to know, before installing anything, what each of the three entry points (`./core`, `./react`, `./server`) gives them, what each depends on, and why `./server` — despite being DOM-free — is not part of `./core`.

**Why this priority**: This is a prerequisite decision every other use of the package depends on. Getting it wrong means installing React (or dagre-only when React was needed) and discovering the mistake late.

**Independent Test**: A reader who has only read this section can correctly state, without opening `src/`, which entry point to install for a headless CLI tool, and can explain why installing the base package alone does not pull in React.

**Acceptance Scenarios**:

1. **Given** the architecture doc, **When** a reader asks "does installing this package require React?", **Then** the doc states plainly that `react`/`react-dom` are optional peers and that `./core` has `@dagrejs/dagre` as its only dependency.
2. **Given** the architecture doc, **When** a reader asks "why isn't `./server` part of `./core`?", **Then** the doc states it is because `./server` drives the renderer through `renderToStaticMarkup`, making it DOM-free but not React-free.

---

### User Story 2 - Determine whether existing C4-PlantUML source will parse (Priority: P1)

A tool builder with existing C4-PlantUML diagrams needs a reference for exactly what the parser in this package accepts, so they can tell whether their source will work before trying it, without reading `src/core/parser.ts`.

**Why this priority**: The parser's behavior (including what it silently strips) is a common source of surprise; documenting it prevents debugging-by-trial-and-error against the source.

**Independent Test**: A reader can, from the DSL reference alone, correctly predict for a given C4-PlantUML snippet whether each macro is recognized, and if recognized, whether it is preserved or stripped.

**Acceptance Scenarios**:

1. **Given** the DSL reference, **When** a reader checks it against `ELEMENT_MACROS` in `src/core/parser.ts`, **Then** every macro key present in `ELEMENT_MACROS` (including all `_Ext` / `Db` / `Queue` variants) appears in the reference.
2. **Given** the DSL reference, **When** a reader looks for `Rel`, its directional variants, and `BiRel`, **Then** the reference documents their argument order and how it differs between `system`-style and `detail`-style macros.
3. **Given** the DSL reference, **When** a reader looks for `@startuml`/`@enduml`, `!include`, and `SHOW_LEGEND()`, **Then** the reference states plainly that these are recognized and stripped, not applied. **When** a reader looks for `LAYOUT_*`, **Then** the reference states that `LAYOUT_TOP_DOWN`/`LAYOUT_LEFT_RIGHT` are recognized and *applied* — they set `C4Diagram.direction`, which changes dagre's layout direction — correcting this spec's original assumption that they were inert (verified against `src/core/parser.ts` and `src/core/layout.ts` during Research/Implement).

---

### User Story 3 - Program against the data model (Priority: P1)

A tool builder writing code against this package needs a description of `C4Diagram`, `C4Element`, `C4Relationship`, `LayoutResult`, `LayoutNode`, `LayoutEdge`, and `Point` that is detailed enough to program against directly, without cross-referencing `src/core/types.ts` line by line.

**Why this priority**: This is what a tool builder actually writes code against; the issue calls it out as the centerpiece of the documentation, not an appendix.

**Independent Test**: A reader can, from this section alone, correctly describe the shape of a parsed diagram and a layout result, including how `C4Element` nesting is represented and what `viewBoxX`/`viewBoxY` are for, without opening `types.ts`.

**Acceptance Scenarios**:

1. **Given** the data model doc, **When** a reader inspects the description of `C4Element`, **Then** it documents how parent/child relationships are represented on the element.
2. **Given** the data model doc, **When** a reader inspects `LayoutResult`, **Then** it documents `LayoutNode`, `LayoutEdge`, `Point`, and the purpose of `viewBoxX`/`viewBoxY`.

---

### User Story 4 - Follow a working recipe for a specific integration (Priority: P2)

A tool builder building one of three specific integrations — headless SVG rendering in a CLI/CI job, embedding the interactive renderer in a non-editor host, or persisting manual positions themselves — needs a complete, runnable example for that integration, not just API descriptions.

**Why this priority**: Recipes turn reference material into a working starting point; ranked below Stories 1–3 because a reader needs the boundary, DSL, and data model understanding first for the recipes to make sense.

**Independent Test**: Each recipe's example code can be copied, run as-is (or with only the diagram source substituted), and produces the described output.

**Acceptance Scenarios**:

1. **Given** the headless rendering recipe, **When** its example is run, **Then** it parses a diagram, lays it out, and emits SVG via `./server`.
2. **Given** the interactive renderer recipe, **When** its example is read, **Then** it demonstrates that `C4InteractiveRenderer` is controlled — it takes `manualPositions` in and calls `onPositionChange` out — and that the host owns that state.
3. **Given** the position-persistence recipe, **When** its example is read, **Then** it shows the storage format is the host's choice, and separately, clearly attributed, describes `@liminis/editor`'s own choice (writing to a markdown code fence's meta string as `@layout {"positions":{…}}`) as one worked example of a host's decision — not as something this package does.

---

### User Story 5 - Learn what this package will not do before building against it (Priority: P1)

A tool builder needs an honest, prominent limitations section so they do not build against an assumption — particularly about the editing experience or persistence — that was never true.

**Why this priority**: The issue explicitly identifies this as the most expensive class of mistake to make, because it is invisible until discovered late. It must be visible early (near the top of the docs), not buried.

**Independent Test**: A reader who reads only the limitations section can correctly answer: does this package provide a text-editing UI? Does it persist layout positions? Are element IDs stable across diagrams? Can one diagram link to another?

**Acceptance Scenarios**:

1. **Given** the limitations section, **When** a reader checks for editing affordances, **Then** it states that the textarea overlay, click-to-edit, layout toolbar, and dark-mode detection are Lexical-bound and stayed in `@liminis/editor` — this package gives render and drag only.
2. **Given** the limitations section, **When** a reader checks for persistence, **Then** it states this package does not persist positions, consistent with Recipe 3.
3. **Given** the limitations section, **When** a reader checks element ID scope, **Then** it states `C4Element.id` is unique only within one diagram, with no cross-diagram identity.
4. **Given** the limitations section, **When** a reader checks for cross-diagram links, **Then** it states there is no `Rel` spanning diagrams and no "detailed in another diagram" syntax, that the parser ignores unknown macros and strips `!include`, and it links to `docs/EXTRACTION-PLAN.md` §6 rather than duplicating it.

---

### Edge Cases

- A reader who only reads the trimmed README (not `docs/`) must still learn, at minimum, that limitations exist and where to find them — the README is not the only place this matters.
- Example code that depends on package internals changing between when it is written and when it is verified must be re-run, not assumed still correct — see FR-011.
- A macro documented in the DSL reference that is later removed from `ELEMENT_MACROS` (or vice versa) would make the reference wrong silently; this is a source-of-truth risk to note, not something this issue needs to solve (no automated sync is in scope).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A `docs/` directory MUST be added containing documentation aimed at a tool builder consuming `@liminis/diagrams` as a dependency, distinct from `docs/EXTRACTION-PLAN.md` (which documents the extraction itself).
- **FR-002**: The documentation MUST explain why there are three entry points (`.`, `./core`, `./react`, `./server`) and what boundary each one buys, specifically: `./core` has `@dagrejs/dagre` as its only dependency and runs with no React installed; `./server` is DOM-free but not React-free because it drives the renderer through `renderToStaticMarkup`, which is why it is not part of `./core`; and installing the base package alone gets a consumer dagre and nothing else, since `react`/`react-dom` are optional peers.
- **FR-003**: The documentation MUST include a C4 DSL reference derived from reading `src/core/parser.ts` at documentation-writing time (not from memory or the existing README), covering every macro key in `ELEMENT_MACROS`, including all `_Ext` / `Db` / `Queue` variants, the boundary macros, `Rel` and its directional variants, `BiRel`, and the argument-order difference between `system`-style and `detail`-style macros.
- **FR-004**: The documentation MUST state explicitly that `@startuml`/`@enduml`, `!include`, and `SHOW_LEGEND()` are recognized by the parser and stripped, not applied. It MUST separately state that `LAYOUT_TOP_DOWN`/`LAYOUT_LEFT_RIGHT` are recognized and **applied** — they set `C4Diagram.direction`, which changes dagre's layout direction — rather than being inert like the other directives listed here (corrected during Research/Implement after verifying against `src/core/parser.ts` and `src/core/layout.ts`; the original assumption that `LAYOUT_*` was inert was factually wrong).
- **FR-005**: The documentation MUST describe the data model — `C4Diagram`, `C4Element` (including how its nesting/parent representation works), `C4Relationship`, `LayoutResult`, `LayoutNode`, `LayoutEdge`, `Point`, and the purpose of `viewBoxX`/`viewBoxY` — in enough detail for a tool builder to program against it directly, and MUST treat this as the centerpiece of the documentation rather than an appendix.
- **FR-006**: The documentation MUST include a complete, runnable recipe for headless rendering in a CLI or CI job: parse, lay out, and emit SVG via `./server`.
- **FR-007**: The documentation MUST include a complete, runnable recipe for embedding `C4InteractiveRenderer` in a non-editor host, and MUST make explicit that the renderer is controlled — it takes `manualPositions` in and calls `onPositionChange` out — with the host owning that state.
- **FR-008**: The documentation MUST include a recipe demonstrating that position persistence is entirely the host's choice, and MUST describe `@liminis/editor`'s markdown-fence-meta-string approach (`@layout {"positions":{…}}`) as one worked example of a host's decision, explicitly attributed to `@liminis/editor` and not described as behavior of this package.
- **FR-009**: The documentation MUST include a limitations section, positioned near the top of the documentation (not buried at the end), stating at minimum: (a) no editing affordance — the textarea overlay, click-to-edit, layout toolbar, and dark-mode detection are Lexical-bound and stayed in `@liminis/editor`; this package provides render and drag only; (b) no persistence of layout positions; (c) element IDs are fence-local — `C4Element.id` is unique within one diagram only, with no cross-diagram identity; (d) no cross-file link syntax — no `Rel` spans diagrams, no "detailed in another diagram" relationship, the parser ignores unknown macros and strips `!include`.
- **FR-010**: The limitations section MUST link to `docs/EXTRACTION-PLAN.md` §6 for items (c) and (d) rather than duplicating its content.
- **FR-011**: Every code example added to the documentation MUST be executed, and the output shown alongside it MUST match what that execution actually produced. No example may be written from memory or adapted from the README without being run.
- **FR-012**: The README MUST be trimmed of any content now covered in `docs/`, retain its role as a quick start, and link into the new `docs/` directory.
- **FR-013**: No documentation added or modified by this issue may state or imply that `@liminis/diagrams` itself persists layout positions.
- **FR-014**: `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` MUST continue to pass after this change.

### Key Entities

- **`docs/` directory**: New documentation aimed at tool builders, distinct from the existing `docs/EXTRACTION-PLAN.md`. Internal file organization (single document vs. one file per topic) is not prescribed by this spec — see Assumptions.
- **README.md**: Existing quick-start document; trimmed of content duplicated in `docs/`, retains an install/quick-render example, and links into `docs/`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader unfamiliar with `src/` can, using only `docs/` and the README, correctly determine which entry point to install for a headless (no-React) use case, and correctly state why the base package does not pull in React.
- **SC-002**: A reader unfamiliar with `src/core/parser.ts` can, using only the DSL reference, correctly predict for a given C4-PlantUML snippet whether each macro used is recognized, and whether recognized-but-non-diagram directives (`@startuml`, `!include`, `SHOW_LEGEND()`, `LAYOUT_*`) are applied or stripped.
- **SC-003**: Every code example in the new documentation, when executed as shown, produces output matching what is documented alongside it.
- **SC-004**: The limitations section correctly conveys, to a reader who has not read the rest of the docs, that this package does not provide an editing UI, does not persist positions, has fence-local element IDs, and has no cross-diagram link syntax.
- **SC-005**: `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass with no changes to `src/`.

## Assumptions

- The internal structure of `docs/` (one file vs. several, naming) is left to the Plan stage; this spec requires the five content areas from the issue (architecture/boundary, DSL reference, data model, recipes, limitations) to exist and be linked from the README, not a specific file layout.
- `verveguy/liminis-editor`'s `src/app/editor/nodes/C4Component.tsx` is used as a reference for what stayed behind in the editor (per the issue's pointers); it lives in a separate repository and is not vendored here. It is consulted via `gh`/web access during Research or Plan, not copied into this repository.
- "Run" in FR-011 means executed against the current `src/` of this package (e.g., via a script, REPL, or test) at documentation-writing time, with the actual output captured — not merely type-checked or visually inspected.
- Sections 1–5 from the issue map to User Stories 1, 2, 3, 4, and 5 respectively; the issue's own priority signal ("deserves the most care" for embedding the interactive renderer) is reflected as acceptance-scenario detail within User Story 4 rather than a higher priority tier, since all of Stories 1, 2, 3, and 5 are prerequisites the issue also treats as essential.

## Out of Scope

- Designing cross-diagram identity or a link syntax. This is future work, described in `docs/EXTRACTION-PLAN.md` §6b/6c — the documentation must describe the gap, not fill it.
- Any change to `src/`. If writing the documentation reveals an API problem, a separate issue must be opened and referenced in a comment on this issue, rather than fixed here.
- A generated API reference (e.g., typedoc). This issue requires hand-written prose aimed at a tool builder, not a symbol dump.
- The demo app (issue #2) and its content.

## Source References

- `docs/EXTRACTION-PLAN.md` — §1 (what was extracted and how cleanly), §2 (the entry-point split and why `./server` is not in `./core`), §6 (what the extraction does not give you)
- `src/core/parser.ts` — `ELEMENT_MACROS` is the authoritative macro list
- `src/core/types.ts` — the data model
- `verveguy/liminis-editor` `src/app/editor/nodes/C4Component.tsx` — the reference host and the clearest illustration of which responsibilities belong to a host rather than to this package
