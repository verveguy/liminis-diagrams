/**
 * Parse `npm pack --json` output into the single entry describing the tarball.
 *
 * Extracted from `verify-package.mjs` so it can be unit-tested against fixtures.
 * That matters more here than it usually would: this is the function that failed
 * v0.1.1's first release attempt, and its correctness depends on which npm major
 * happens to be installed — so testing it by *running* npm proves only whatever
 * the local machine has, and CI gives no signal about the other shapes.
 *
 * Known shapes, each captured as a fixture in the test alongside:
 *
 *   npm 10.8.2, 11.5.1   [ { name, files: [...] } ]          top-level array
 *   npm 12.0.2           { "<pkg>": { files: [...] } }        keyed by package
 *
 * An unwrapped object is also accepted, defensively, in case a future major
 * drops the wrapper.
 */

/**
 * Locate and parse the JSON payload in npm's stdout.
 *
 * npm may print warnings, notices or ANSI colour codes before the payload, so
 * the JSON does not necessarily start at byte zero. Rather than assume the first
 * `[` or `{` begins it — which breaks when a preamble line happens to contain a
 * bracket, and ANSI escapes (`\x1b[...`) contain one by construction — every
 * candidate position is tried in order until one parses. The first that does is
 * the payload.
 */
function locateJson(raw) {
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '[' && ch !== '{') continue;
    try {
      return JSON.parse(raw.slice(i));
    } catch {
      // Not the start of the payload — keep looking.
    }
  }
  return undefined;
}

/**
 * @param {string} raw       stdout from `npm pack --json`
 * @param {string} npmVersion reported in errors, so a failure is diagnosable in one run
 * @returns {{files: {path: string}[], unpackedSize?: number}}
 */
export function parsePackOutput(raw, npmVersion = 'unknown') {
  const excerpt = raw.slice(0, 600);
  const parsed = locateJson(raw);

  if (parsed === undefined) {
    throw new Error(
      `npm pack --json produced no parseable JSON (npm ${npmVersion}). Raw output:\n${excerpt}`,
    );
  }

  let entry = Array.isArray(parsed) ? parsed[0] : parsed;

  // npm 12 keys the result by package name. Unwrap when exactly one value looks
  // like a tarball description; more than one is ambiguous and should be a loud
  // failure rather than a guess.
  if (entry && !Array.isArray(entry.files)) {
    const candidates = Object.values(entry).filter(
      (v) => v && typeof v === 'object' && Array.isArray(v.files),
    );
    if (candidates.length === 1) entry = candidates[0];
    else if (candidates.length > 1) {
      throw new Error(
        `npm pack --json returned ${candidates.length} tarball entries (npm ${npmVersion}); ` +
          `expected exactly one. Keys: [${Object.keys(entry).join(', ')}]`,
      );
    }
  }

  if (!entry || !Array.isArray(entry.files)) {
    throw new Error(
      `npm pack --json returned an unrecognised shape (npm ${npmVersion}) — expected an ` +
        `object with a \`files\` array, got keys [${entry ? Object.keys(entry).join(', ') : 'none'}]. ` +
        `Raw output:\n${excerpt}`,
    );
  }

  return entry;
}
