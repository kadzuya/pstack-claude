#!/usr/bin/env bun
// Claude Code caches an installed plugin by its version, so a change to the
// Projects layer that ships under an unchanged version never reaches an
// installed copy. tools/projects-layer.json records the hash of the shipped
// Projects-layer files at the current VERSION; tests/projects-layer.test.mjs
// fails when the files change and the record does not.
//
// Usage, after bumping VERSION: bun tools/projects-layer.mjs
//   --amend rewrites the hash for an unchanged VERSION, for a version that has
//   not been merged yet (a review fix on the PR that bumped it).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

// The fork's files that ship inside the plugin. docs/projects-*.md do not ship.
export const PROJECTS_LAYER_FILES = [
  "plugins/pstack/hooks/session-start-projects.md",
  "plugins/pstack/hooks/session-start.sh",
  "plugins/pstack/skills/poteto-mode/references/projects-tools.md",
];

export const RECORD = "tools/projects-layer.json";

export function projectsLayerHash(root = repo) {
  const hash = createHash("sha256");
  for (const file of PROJECTS_LAYER_FILES) {
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(root, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function readRecord(root = repo) {
  return JSON.parse(readFileSync(join(root, RECORD), "utf8"));
}

if (import.meta.main) {
  const version = readFileSync(join(repo, "VERSION"), "utf8").trim();
  const sha256 = projectsLayerHash();
  const record = readRecord();
  if (record.sha256 === sha256 && record.version === version) {
    console.log(`${RECORD} is current at ${version}`);
  } else if (record.version === version && !process.argv.includes("--amend")) {
    console.error(
      `The Projects layer changed but VERSION is still ${version}. Bump VERSION to the next -projects.N, add its CHANGES.md entry, run bun tools/generate.mjs, then rerun this.`,
    );
    process.exit(1);
  } else {
    writeFileSync(join(repo, RECORD), `${JSON.stringify({ version, sha256 }, null, 2)}\n`);
    console.log(`${RECORD} records ${version}`);
  }
}
