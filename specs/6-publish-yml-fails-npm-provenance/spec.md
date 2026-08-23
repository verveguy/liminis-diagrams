# Feature Specification: Add `repository` field to unblock npm provenance publish

**Feature Branch**: `fabrik/issue-6`
**Created**: 2026-08-22
**Status**: Specified
**Input**: User description: "publish.yml fails: npm provenance rejects publish because package.json has no repository field"

## Background

The first real publish attempt for `@liminis/diagrams@0.1.0` (issue #3) failed at the `Publish` step of `publish.yml`. Nothing was published to npm — the registry still shows only the `0.0.0` placeholder, confirmed via `npm view @liminis/diagrams versions` and `dist-tags` after the failure. The triggering GitHub Release (`v0.1.0`, tag pointing at `bc75841f49fc0013ff1039b9a452631c88f63d3a`) has been deleted since it did not correspond to a real publish, to avoid leaving a misleading release/tag in the repo.

The failure:

```
npm error code E422
npm error 422 Unprocessable Entity - PUT https://registry.npmjs.org/@liminis%2fdiagrams -
Error verifying sigstore provenance bundle: Failed to validate repository information:
package.json: "repository.url" is "", expected to match "https://github.com/verveguy/liminis-diagrams" from provenance
```

`package.json` has no `repository` field. `publish.yml` runs `npm publish --provenance ...`, and npm's registry cross-checks the provenance attestation's source repo (from the GitHub Actions OIDC claim) against `package.json`'s `repository.url`. With the field absent, the check fails and the publish is rejected. This happens *after* the provenance statement is already signed and logged to the public Sigstore transparency log — harmless, but it means a failed attempt still leaves a public transparency-log entry.

Research/Plan for issue #3 had flagged the missing `repository`/`homepage` fields as a known gap, but assessed it as "cosmetic, not blocking" since no functional requirement covered it at the time. Under npm's current `--provenance` verification behavior, it is in fact a hard blocker for every publish attempt, not a cosmetic gap.

Everything else about the release path is confirmed working (verified against commit `bc75841f49fc0013ff1039b9a452631c88f63d3a` before the failed release was cut):

- `npm pack --dry-run`: tarball contains only `dist/**`, `LICENSE`, `README.md`, `package.json` — no `src/`, `demo/`, `specs/`.
- All four entry points (`.`, `./core`, `./react`, `./server`) resolve from the packed tarball with React peers present.
- `./core` resolves and runs a full parse/validate/layout with no React on disk at all (`--omit=peer`), confirming the package's central architectural claim.
- `publish.yml`'s typecheck/lint/test/build steps, the tag-vs-version check, and the dist-tag derivation (`latest` for `0.1.0`) all passed in the actual workflow run before the `Publish` step failed.
- npm Trusted Publisher OIDC auth itself succeeded — the failure is a registry-side provenance content check, not an auth failure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintainer publishes a release and it reaches the registry (Priority: P1)

A maintainer cuts a GitHub Release for `@liminis/diagrams`. `publish.yml` runs, builds the package, and publishes it to npm with provenance. The publish succeeds and the version becomes visible on the registry.

**Why this priority**: This is the entire purpose of the workflow. Without it, no version of this package can ever reach npm, which blocks issue #3's outcome entirely.

**Independent Test**: Cut a release targeting a commit with the `repository` field present; confirm the `Publish` step of `publish.yml` completes without error and `npm view @liminis/diagrams versions` lists the new version.

**Acceptance Scenarios**:

1. **Given** `package.json` has a `repository.url` of `git+https://github.com/verveguy/liminis-diagrams.git`, **When** `publish.yml` runs `npm publish --provenance` from a workflow run in this repository, **Then** npm's provenance repository check passes and the publish completes.
2. **Given** the published package on npm, **When** a consumer views the package page or runs `npm view @liminis/diagrams repository`, **Then** it shows a link back to `https://github.com/verveguy/liminis-diagrams`.

---

### Edge Cases

- If a future fork or mirror of this repository attempts to publish under this package name via its own `publish.yml`, the provenance check will fail because the OIDC claim's repository won't match `package.json`'s `repository.url` — this is expected, correct behavior (it's the protection the check exists to provide), not a bug to work around.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `package.json` MUST include a `repository` field of the form `{ "type": "git", "url": "git+https://github.com/verveguy/liminis-diagrams.git" }`, matching the repository npm's provenance check expects.
- **FR-002**: `package.json` MUST include a `homepage` field pointing at the repository (e.g. `https://github.com/verveguy/liminis-diagrams#readme`), as a companion metadata addition alongside `repository`. This is not required to unblock provenance, but is trivial, zero-risk, and improves the package's npm registry page.
- **FR-003**: No other change to `publish.yml`, the build, or the publish process is required or in scope — the verification already performed (per Background) is assumed still valid once this field is added.

### Key Entities

- **`package.json` manifest**: The npm package manifest for `@liminis/diagrams`; gains `repository` and `homepage` fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A GitHub Release cut against a commit that includes this change causes `publish.yml`'s `Publish` step to complete successfully (exit 0), with no `E422` provenance error.
- **SC-002**: `npm view @liminis/diagrams versions` and `dist-tags` reflect a published `0.1.0` (or later) version after the release, rather than only the `0.0.0` placeholder.

## Assumptions

- The canonical repository URL is `https://github.com/verveguy/liminis-diagrams`, matching the GitHub Actions OIDC claim that will be presented at publish time.
- This fix only needs to land on `main` before the next release is cut; it does not itself trigger a publish. Re-attempting the actual `v0.1.0` publish (reverifying CI, cutting a fresh release, confirming the registry) is a follow-up operational step outside this codebase change, tracked by this issue's process but not a code requirement of this spec.
- No functional/runtime behavior of the package itself changes — this is a manifest metadata fix only.

## Out of Scope

- Re-cutting the `v0.1.0` GitHub Release and re-running the actual publish (operational follow-up, not a code change).
- Any change to `publish.yml`'s logic, permissions, or provenance configuration.
- Adding a `bugs` field or other optional `package.json` metadata beyond `repository`/`homepage`.

## Source References

- Failed run: https://github.com/verveguy/liminis-diagrams/actions/runs/32611994114
- Originating issue: #3
- `package.json` (repo root) — no `repository`, `homepage`, or `bugs` field currently present
- `.github/workflows/publish.yml` — runs `npm publish --provenance`
