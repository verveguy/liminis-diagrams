# Feature Specification: CI and release workflows

**Feature Branch**: `fabrik/issue-1`
**Created**: 2026-08-22
**Status**: Draft
**Input**: User description: "`liminis-diagrams` has no GitHub Actions. Every check (`test`, `typecheck`, `lint`, `build`) currently only runs locally, and there is no path to publishing `@liminis/diagrams` to npm. … Two workflows, mirroring `verveguy/liminis-editor`'s (read those first — they are the reference implementation, not a starting point to improve on)."

## Background

`@liminis/diagrams` was extracted from `liminis-editor` (`docs/EXTRACTION-PLAN.md`). The package builds, 106 tests pass, and the manifest carries `lint`, `typecheck`, `test` and `build` scripts plus a `prepublishOnly` publish guard — but every one of those checks only ever runs on a developer's machine. There is no automated gate on a pull request, and no path at all to getting the package onto npm.

`docs/EXTRACTION-PLAN.md` §7 sequences this as step 5, "CI workflow + release/publish workflow". It blocks step 6 (publish `0.1.0`, issue #3), which in turn blocks step 7 (the editor PR that deletes its local C4 copy and consumes the package). Nothing downstream of the extraction moves until these two files exist.

The reference implementation already exists and is in production: `verveguy/liminis-editor` has both workflows, and five releases (`v0.1.1` … `v0.3.0`) have been cut through its `publish.yml`. This issue mirrors them, adapted to a package that has no `verify:package` script, no `examples/`, and no Electron host — so the editor's `package-build`, `examples-build` and `electron-shell-e2e` jobs have no counterpart here. **They are the reference implementation, not a starting point to improve on.**

The publish guard is the load-bearing part, and the reason the release workflow's shape matters more than its convenience. `scripts/guard-publish.mjs` runs from `prepublishOnly` and exits non-zero unless `LIMINIS_ALLOW_PUBLISH=1`. A `private: true` flag would not do this job — `npm publish --dry-run` (npm 10.8.2) does not report a private package as blocked, so the rehearsal gives no signal and the first honest confirmation would be a real publish, inside npm's 72-hour unpublish window. The guard's entire value comes from that variable being set in exactly one place, at step scope, in the release workflow: **that** is what makes cutting a release the only path that publishes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A pull request is gated by automated checks (Priority: P1)

A contributor — a person, or a Fabrik Implement worker — opens a pull request against `main`. GitHub Actions installs dependencies from the committed lockfile and runs lint, typecheck, test and build. The pull request shows a check that is green or red on its own evidence, rather than on the author's assurance that it passed locally.

**Why this priority**: nothing else here can be confirmed without it — the acceptance criterion "CI passes green on the PR that adds them" is self-verifying. It is also the gate the rest of the Fabrik pipeline waits on before a PR can be reviewed or merged.

**Independent Test**: open a pull request against `main` and observe the workflow run and its conclusion.

**Acceptance Scenarios**:

1. **Given** a pull request against `main` whose source passes all four scripts locally, **When** CI runs, **Then** the workflow concludes `success`.
2. **Given** a pull request whose source fails `pnpm lint`, **When** CI runs, **Then** the workflow concludes `failure` and the failing step is identifiable as the lint step.
3. **Given** a pull request whose source fails `pnpm typecheck`, **When** CI runs, **Then** the workflow concludes `failure` at the typecheck step.
4. **Given** a pull request with a failing test, **When** CI runs, **Then** the workflow concludes `failure` at the test step.
5. **Given** a pull request where `pnpm build` errors, **When** CI runs, **Then** the workflow concludes `failure` at the build step.
6. **Given** a `pnpm-lock.yaml` inconsistent with `package.json`, **When** CI installs, **Then** `--frozen-lockfile` fails the run rather than silently resolving new versions.

---

### User Story 2 - Cutting a release publishes the package, and nothing else can (Priority: P1)

A maintainer cuts a release. That act, and only that act, sets `LIMINIS_ALLOW_PUBLISH=1`, so the guard stands aside and `npm publish` proceeds. No other workflow, job, or step in the repository can publish as a side effect of doing something else — and the release path re-runs the full check suite first, so a release cannot ship code that does not pass.

**Why this priority**: without it there is no route to npm at all, and both issue #3 and `EXTRACTION-PLAN` step 7 are blocked behind it.

**Independent Test**: the workflow file can be read and grepped without executing it. Its live behaviour against the registry is deliberately exercised for the first time in issue #3 — not here.

**Acceptance Scenarios**:

1. **Given** the release workflow, **When** it is inspected, **Then** `LIMINIS_ALLOW_PUBLISH` is set exactly once, under a single step's `env:` key, on the step that runs `npm publish`.
2. **Given** every other workflow, job and step in the repository, **When** they are inspected, **Then** none of them sets `LIMINIS_ALLOW_PUBLISH` at workflow, job or step scope.
3. **Given** the pull request that adds these two workflows, **When** it is pushed, updated and merged, **Then** the publish workflow does not run at any point.
4. **Given** a release whose tag implies a version that disagrees with `package.json`, **When** publish runs, **Then** it fails before contacting the registry, naming both versions.
5. **Given** a release whose `package.json` version carries a prerelease suffix (e.g. `0.2.0-rc.1`), **When** publish runs, **Then** it publishes under a dist-tag other than `latest`, so `npm install @liminis/diagrams` does not start handing an rc to callers.
6. **Given** a release whose commit fails `pnpm test`, **When** publish runs, **Then** it fails before publishing.

---

### Edge Cases

- **CI must not reach outward.** No step checks out, fetches, or authenticates against any other repository. That independence is the point of the extraction and is cheap to lose by accident; it should stay a one-line grep to confirm.
- **A hung job.** GitHub's 360-minute default outlasts Fabrik's CI-wait gate, which pauses the issue and needs a human to restart it. Every job is capped well below that.
- **A release cut from a stale commit**, whose CI has expired or never ran. The release path re-runs the checks itself rather than trusting a merge-time result.
- **Third-party lifecycle scripts.** Jobs that install dependencies run other people's code; the checkout credential should not be left in `.git/config` where that code can read it.
- **`@liminis/diagrams` has never been published.** npm cannot register a trusted publisher for a package name that does not yet exist on the registry, so the very first publish cannot authenticate by OIDC. That first publish is issue #3's problem, not this one's — but the shape of `publish.yml` decides how hard it will be. See Open Questions Q2.
- **Node version gap.** `engines.node` declares `>=22` while CI tests only 24. This is supported-by-intent, not supported-by-test, and the workflow should say so rather than leave the discrepancy looking accidental.

## Requirements *(mandatory)*

### Functional Requirements — `.github/workflows/ci.yml`

- **FR-001**: A workflow file exists at `.github/workflows/ci.yml`.
- **FR-002**: It triggers on `pull_request` and on `push`, scoped per Q3.
- **FR-003**: pnpm is provisioned by `pnpm/action-setup@v4`, taking its version from the `packageManager` field in `package.json` (`pnpm@10.33.0`) rather than a second, independently-drifting pin in the workflow.
- **FR-004**: Node 24 is provisioned by `actions/setup-node@v4` with pnpm caching enabled, and the file records why 24 is tested while `engines.node` claims `>=22`.
- **FR-005**: Dependencies install with `pnpm install --frozen-lockfile`.
- **FR-006**: `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` each run as a separately named step, so a failure names which check failed. A non-zero exit from any of the four fails the workflow.
- **FR-007**: The test step runs `pnpm test`, not `pnpm test:coverage`, and no coverage artifact is produced or uploaded — a deliberate divergence from the editor, whose `checks` job uploads to Codecov.
- **FR-008**: Every job sets `timeout-minutes` to a value comfortably above a healthy run and far below GitHub's default.
- **FR-009**: No step, and no comment, references any other repository — no checkout, no fetch, no token, no name.

### Functional Requirements — `.github/workflows/publish.yml`

- **FR-010**: A workflow file exists at `.github/workflows/publish.yml`, triggered per Q1.
- **FR-011**: `LIMINIS_ALLOW_PUBLISH: '1'` is set under the `env:` key of the single step that runs `npm publish`, with a comment stating why the scope is what makes the guard work.
- **FR-012**: That is the only place in the repository where the variable is assigned to a process. Existing *mentions* — the `//publishing` note in `package.json`, the four occurrences in `scripts/guard-publish.mjs` (its own read of the variable, plus the manual escape hatch it prints), and the prose in `docs/EXTRACTION-PLAN.md` — are documentation of the policy, not assignments, and none of them are touched.
- **FR-013**: The publish step runs `npm publish --access public` (plus the flags implied by Q2's answer and by FR-017).
- **FR-014**: The workflow declares the minimum `permissions` its chosen authentication method requires, and no more.
- **FR-015**: `pnpm typecheck`, `pnpm lint` and `pnpm test` run and pass before the publish step is reached. This duplicates `ci.yml` on purpose: `ci.yml` gates merges, this gates releases, and the two can be cut from different commits.
- **FR-016**: A step fails the run if the version implied by the release tag disagrees with `package.json`'s `version`, printing both.
- **FR-017**: A step derives the dist-tag from the version: `latest` for a plain version, a non-`latest` tag for anything carrying a prerelease suffix.
- **FR-018**: The job uses the same Node major and pnpm provisioning as `ci.yml`, with a comment noting that the two must move together.
- **FR-019**: The workflow cannot be triggered by a branch push or a pull request.

### Key Entities

- **`LIMINIS_ALLOW_PUBLISH`**: an environment variable whose only meaningful value is the string `'1'`. Read by `scripts/guard-publish.mjs`; set by exactly one workflow step. Its scope, not its value, is the control.
- **The publish guard** (`scripts/guard-publish.mjs`): existing, unchanged. Runs from `prepublishOnly`, which fires on `npm publish` but not on `npm pack` or `npm install`, so packing a tarball for a consumer is unaffected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both workflow files exist on the branch, and the CI workflow concludes `success` on the pull request that adds them.
- **SC-002**: Each of the four checks, made to fail deliberately in isolation, causes the CI run to conclude `failure` — demonstrated for all four, then reverted, leaving no trace of the deliberate failures in the merged diff.
- **SC-003**: Searching the repository for `LIMINIS_ALLOW_PUBLISH` returns exactly one assignment to a process, at step scope in `publish.yml`; every other occurrence is prose or the guard's own read.
- **SC-004**: The publish workflow records zero runs across the entire lifetime of this pull request, including after merge.
- **SC-005**: Nothing under `src/`, no `package.json` script, and no line of `scripts/guard-publish.mjs` differs from `main` in the merged diff.
- **SC-006**: A reader of `publish.yml` can determine, from the file alone, why a release is the only thing that publishes.

## Assumptions

- **A-01**: "Mirroring the editor" governs anything this issue does not spell out. Where the issue text and the editor's files disagree in wording but not in intent, the editor's files win; where they disagree materially, it is an Open Question below rather than a silent choice.
- **A-02**: Only the editor's `checks` job has a counterpart here. `package-build`, `examples-build` and `electron-shell-e2e` depend on `verify:package`, `build:examples` and an Electron host, none of which exist in this repository — and adding them would require the `package.json` script changes this issue puts out of scope.
- **A-03**: The order of the four check steps is not functionally significant. The issue lists them lint → typecheck → test → build; the editor runs typecheck → lint → build → test. Either satisfies FR-006.
- **A-04**: The editor's `ci.yml` header comment points at its `docs/provenance.md`. The equivalent record here is `docs/EXTRACTION-PLAN.md`; the pointer is adapted, and the substance of the comment (CI does not reach outward) is carried over intact.
- **A-05**: `liminis-diagrams` is a public repository, so npm provenance attestation is available to it.
- **A-06**: The `--access public` in `publishConfig` and the explicit `--access public` on the publish command are both kept, as the editor does. The redundancy is deliberate: `publishConfig` has burned this package family before (see the `//entrypoints` note in `package.json` and the editor's ADR-078).
- **A-07**: Verifying SC-002 requires a run that is genuinely triggered. If CI is scoped to `main` (Q3), a scratch-branch push alone will not fire it and the deliberate failures must be pushed onto the branch that already has a pull request open, then reverted.
- **A-08**: No repository secret or npm registry configuration is created as part of this issue. If Q2's answer requires one, arranging it is issue #3's work; this issue delivers the workflow that will use it.

## Out of Scope

- Actually publishing to npm. That is issue #3, and it must not happen here.
- Registering a trusted publisher on npmjs.com, or creating an `NPM_TOKEN` secret.
- Coverage reporting, coverage upload, README badges, release-notes automation.
- Any change to `src/`, to `package.json` scripts, or to `scripts/guard-publish.mjs`.
- A GitHub Pages workflow. The editor has `pages.yml`; the equivalent here is issue #2 and is not part of this issue.
- Matrixing CI over Node 22 as well as 24. Worth doing if a consumer reports actually running 22; not worth the CI minutes before then.
- Branch protection rules, required-check configuration, or any other repository setting outside the two workflow files.

## Source References

- `verveguy/liminis-editor` `.github/workflows/ci.yml` — reference implementation (4 jobs; only `checks` has a counterpart here)
- `verveguy/liminis-editor` `.github/workflows/publish.yml` — reference implementation (release-triggered, OIDC trusted publishing, provenance)
- `scripts/guard-publish.mjs` — the guard, unchanged by this issue
- `package.json` — `packageManager`, `engines`, `publishConfig`, `prepublishOnly`, and the `//publishing` note explaining the guard
- `docs/EXTRACTION-PLAN.md` §7 — sequencing; this is step 5
- Issue #3 "Publish `@liminis/diagrams` 0.1.0 to npm" — step 6, blocked by this
- Issue #2 "GitHub Pages demo app" — the `pages.yml` counterpart, out of scope here
