# Rendering C4-PlantUML diagrams on GitHub

GitHub's markdown renderer shows `.svg` files and `<img>` references natively; it has
no extension point for rendering `.puml` source itself, and no "register a custom image
provider" hook. So there is no way to make GitHub call this library directly when
someone browses a `.puml` file or a fenced ` ```plantuml ` block.

What works instead — and is the standard pattern people already use for Mermaid,
Graphviz, and PlantUML on GitHub — is **pre-rendering**: turn each diagram source file
into a checked-in `.svg` as part of CI, and reference that `.svg` from markdown. GitHub
then just renders an image, which it already knows how to do.

```
docs/architecture.puml   →  render-c4  →  docs/architecture.svg
```

```markdown
![Architecture](./architecture.svg)
```

## The `render-c4` CLI

This package ships a small CLI for exactly this step. It wraps
[`renderC4DiagramToSVG`](../src/server/render-to-string.ts) — the same function
`@liminis/diagrams/server` exports for programmatic use — so a checked-in diagram
renders with the same engine as anything you render in-app.

```bash
npx @liminis/diagrams render-c4 docs/architecture.puml
# docs/architecture.puml -> docs/architecture.svg

npx @liminis/diagrams render-c4 --dark docs/architecture.puml -o docs/architecture-dark.svg

npx @liminis/diagrams render-c4 --check docs/**/*.puml
# validates every file, writes nothing, exits non-zero if any fails to parse
```

| Flag | Effect |
|---|---|
| `--dark` | Render in dark mode |
| `-o, --out <file>` | Output path (only valid with exactly one input file) |
| `--out-dir <dir>` | Write outputs here, preserving basenames, extension replaced with `.svg` |
| `--check` | Validate only — write nothing, exit non-zero on any parse/validation error |
| `--stdin` | Read source from stdin, write SVG to stdout — no filesystem involved |

Exit code is `0` on success, `1` on a usage error, `2` if any input file failed to
render. Errors are printed as `path:line:column: message`, one per line, so they read
like a linter's output in a CI log.

## Wiring it into a GitHub Action

The shape that keeps rendered diagrams honest is: render on every push to the default
branch, commit the result back, and — separately — fail the check on a pull request if
a diagram doesn't parse, without committing anything (`main` hasn't moved yet, so there
is nothing to commit to).

```yaml
# .github/workflows/render-diagrams.yml
name: render-diagrams

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate diagrams
        if: github.event_name == 'pull_request'
        run: npx @liminis/diagrams render-c4 --check $(git ls-files '*.puml')

      - name: Render diagrams
        if: github.event_name == 'push'
        run: npx @liminis/diagrams render-c4 $(git ls-files '*.puml')

      - name: Commit rendered SVGs
        if: github.event_name == 'push'
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add '*.svg'
          git diff --staged --quiet || git commit -m "Render C4 diagrams [skip ci]"
          git push
```

Adjust the `git ls-files` glob to wherever `.puml` sources actually live in your repo.
`[skip ci]` in the commit message keeps the render-back from re-triggering this same
workflow; use whatever your CI provider's equivalent marker is if you're not on GitHub
Actions' default behavior.

If you'd rather not grant `contents: write` to a workflow, render as a build artifact
instead of committing back, and reference the artifact's published location (e.g. GitHub
Pages) from markdown instead of a relative repo path — the CLI itself doesn't care
which; it only produces files on disk.
