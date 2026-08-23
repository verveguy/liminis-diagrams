# Feature Specification: Publish @liminis/diagrams 0.1.0 to npm

**Feature Branch**: `fabrik/issue-3`
**Created**: 2026-08-22
**Status**: Specified
**Input**: User description: "The package is complete and green but unpublished, so nothing can consume it — including `liminis-editor`, which still carries its own copy of the C4 code. Until this lands, the same code lives in two repos and can silently diverge. Publish `@liminis/diagrams@0.1.0` to npm via the release workflow."

## Background

`@liminis/diagrams` was extracted from `liminis-editor` (see `docs/EXTRACTION-PLAN.md`) as a standalone package, and its source tree, tests, and CI are complete and green. It is not yet installable from npm, which means `liminis-editor` still carries its own copy of the C4 code rather than depending on the package. As long as that duplication persists, the two copies can silently diverge.

This issue is step 6 of the extraction plan: publish `0.1.0` through the guarded release workflow added by issue #1 (CI and release workflows, closed). It unblocks the GitHub Pages demo app (issue #2) and the editor-side migration to consume the package instead of its own copy (editor#100), both of which are intentionally sequenced behind this one.

Publishing is guarded on two fronts, and both exist because a real incident is cheap to avoid and expensive to undo:
- `scripts/guard-publish.mjs` refuses `npm publish` unless `LIMINIS_ALLOW_PUBLISH=1` is set, because `npm publish --dry-run` (npm 10.8.2) gives no signal that a publish would actually happen.
- npm's unpublish window is 72 hours and narrower than people expect — an accidental or premature publish of `0.1.0` is close to irreversible.

A related one-time step, `scripts/bootstrap-npm-name.sh`, has already reserved the `@liminis/diagrams` name on npm with a `0.0.0` placeholder (published 2026-08-23, 2 files, 528 bytes, no code; dist-tags `placeholder` and `latest` both currently point at it). Its browser-based next step — registering `verveguy/liminis-diagrams`'s `publish.yml` as a Trusted Publisher on the package's npmjs.com settings page — is also confirmed done, per @verveguy, 2026-08-23: publisher GitHub Actions, organization/user `verveguy`, repository `liminis-diagrams`, workflow filename `publish.yml`, no environment, allowed actions scoped to **`npm publish` only** (staged publishing was deliberately not granted, since `publish.yml` doesn't use it).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish the real release through the guarded workflow (Priority: P1)

As the maintainer, I want `@liminis/diagrams@0.1.0` published to npm via `publish.yml` (triggered by a published GitHub Release), so that `liminis-editor` and other future consumers can install the package instead of maintaining their own copy of the C4 code.

**Why this priority**: This is the entire point of the issue — nothing downstream (the demo app, the editor migration) can proceed until the package resolves from npm.

**Independent Test**: From a machine with no local checkout of this repo, run `npm install @liminis/diagrams` in a scratch directory and confirm it resolves `0.1.0` with a working README and license on the npm package page.

**Acceptance Scenarios**:

1. **Given** CI is green on `main` and every precondition below has been verified (not assumed), **When** a GitHub Release for `0.1.0` is published, **Then** `publish.yml` runs the full suite, builds, and publishes `@liminis/diagrams@0.1.0` to npm with provenance.
2. **Given** any precondition fails (e.g. the packed tarball includes `src/`, or `./core` pulls in React), **When** that failure is discovered, **Then** the process stops without publishing, and a separate issue is opened to fix the underlying problem — the failure is not patched and published in the same pass.

---

### Edge Cases

- `@liminis/diagrams` currently has only a `0.0.0` placeholder version on npm, with dist-tag `latest` pointing at it. A successful `0.1.0` publish must move `latest` to `0.1.0`.
- `./core` must resolve and run with **no React present at all** (peers omitted) — this is the package's central architectural claim (see `README.md`'s entry-point table) and the one precondition most likely to regress silently.
- `LIMINIS_ALLOW_PUBLISH=1` must be scoped to only the `npm publish` step inside `publish.yml`, not the job or workflow — this is what keeps the guard meaningful.
- The npm Trusted Publisher registration is scoped to the `npm publish` action only, not staged publishing. If `publish.yml` is ever changed to publish in two steps (e.g. a separate stage/publish action), the registration must be updated first, or the workflow will fail to authenticate rather than silently working.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CI MUST be verified green on `main` (not assumed) before any publish action is taken.
- **FR-002**: `npm pack --dry-run` output MUST contain only files under `dist/` — no `src/`, `demo/`, `specs/`, or `.ts` sources.
- **FR-003**: All four package entry points (`.`, `./core`, `./react`, `./server`) MUST resolve correctly when the packed tarball is installed into a scratch directory.
- **FR-004**: `./core` MUST import successfully when installed with peer dependencies omitted (`--omit=peer`, or into a project with no React on disk), confirming it pulls in no React.
- **FR-005**: `LIMINIS_ALLOW_PUBLISH=1` MUST be set only at step scope within `publish.yml`, not at job or workflow scope.
- **FR-006**: The publish MUST occur via the release workflow (`publish.yml`, triggered by a published GitHub Release) — not a manual or local `npm publish`.
- **FR-007**: If any precondition (FR-001 through FR-005, or FR-011) fails, the process MUST stop without publishing, and a separate issue MUST be opened to address the failure.
- **FR-008**: After publish, `npm install @liminis/diagrams` MUST succeed from a clean directory and resolve `0.1.0`.
- **FR-009**: The npm package page for `@liminis/diagrams` MUST display the README and MIT license.
- **FR-010**: A git tag corresponding to the `0.1.0` release MUST exist in the repository.
- **FR-011**: Before contacting the registry, the release process MUST verify that `package.json`'s `version` field is exactly `0.1.0` and agrees with the release tag; a mismatch MUST fail the run rather than attempt to publish.
- **FR-012**: The publish MUST land on the npm dist-tag `latest` — `0.1.0` is a stable release with no prerelease suffix — so that it supersedes the `0.0.0` placeholder currently holding `latest`.

### Key Entities

- **Release workflow** (`.github/workflows/publish.yml`): GitHub Actions workflow triggered by `release: published`; runs the full test suite and build, then publishes via `prepublishOnly` → `scripts/guard-publish.mjs`, authenticated by npm trusted publishing (OIDC).
- **npm Trusted Publisher**: OIDC-based publish authorization, registered on `@liminis/diagrams`'s npmjs.com package settings page, binding publish rights to `verveguy/liminis-diagrams`'s `publish.yml` workflow specifically, scoped to the `npm publish` action only (confirmed registered — see Background).
- **`0.0.0` placeholder**: The existing npm release reserving the package name (published by `scripts/bootstrap-npm-name.sh`), currently holding both the `placeholder` and `latest` dist-tags. Retiring it (via `npm deprecate`) is explicitly deferred until after `0.1.0` is live, and is out of scope here.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm install @liminis/diagrams` succeeds from a clean directory and resolves version `0.1.0`.
- **SC-002**: The npm package page for `@liminis/diagrams` shows the README content and the MIT license.
- **SC-003**: A git tag corresponding to the `0.1.0` release exists in the repository.
- **SC-004**: Every precondition in the Functional Requirements is verified with recorded evidence before the publish action is taken — none are assumed.

## Assumptions

- The Fabrik pipeline (this issue's Implement stage) is authorized to create the GitHub Release that triggers `publish.yml` — and therefore the actual, close-to-irreversible npm publish — once every precondition above passes. This issue's acceptance criteria describe a *published* package, not merely a readiness check, so cutting the release is understood to be this issue's own terminal action rather than a follow-up for a human to trigger separately.
- Tag/release naming follows standard semver convention (e.g. `v0.1.0`); the repository has no prior tag to conform to, since this would be its first release.
- CI was confirmed green on `origin/main` during this Specify pass (run on commit `bc75841`, 2026-08-23) but MUST be re-verified at Implement time, since `main` can move between now and then.

## Out of Scope

- Any code change to the package. If a precondition fails, stop and open a separate issue rather than fixing it here and publishing anyway.
- Deprecating the `0.0.0` placeholder version — explicitly deferred until after `0.1.0` is live (`scripts/bootstrap-npm-name.sh`'s step 3), to avoid marking the entire package deprecated while `0.0.0` is still the only version.
- The `liminis-editor` migration to consume the published package (tracked separately as editor#100).
- The GitHub Pages demo app (issue #2), which is intentionally sequenced behind this issue.

## Source References

- `scripts/guard-publish.mjs` — the publish guard; read its header comment before touching the publish path.
- `scripts/bootstrap-npm-name.sh` — one-time npm name reservation and Trusted Publisher setup instructions.
- `.github/workflows/publish.yml` (on `main`) — the release workflow itself.
- `docs/EXTRACTION-PLAN.md` §7 — sequencing context; this issue is step 6.
- Issue #1 (closed) — CI and release workflows, the precondition this issue was blocked on.
