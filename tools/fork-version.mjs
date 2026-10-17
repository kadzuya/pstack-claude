#!/usr/bin/env bun
// Claude Code caches an installed plugin by its version, so a change to the
// shipped plugin under an unchanged version never reaches an installed copy.
// tools/fork-version.json records a hash of every file under plugins/pstack at
// the current VERSION; tests/fork-version.test.mjs fails when the plugin
// changes and the record does not.
//
// Usage, after bumping VERSION: bun tools/fork-version.mjs
//   --amend rewrites the hash for an unchanged VERSION, for a version that has
//   not been merged yet (a review fix on the PR that bumped it).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PLUGIN } from "./plugin.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

export const RECORD = "tools/fork-version.json";

// Tracked and new files, as git would ship them; ignored ones (node_modules) are not.
function pluginFiles(root) {
  const result = spawnSync("git", ["ls-files", "-z", "-co", "--exclude-standard", "--", PLUGIN], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr}`);
  return result.stdout.split("\0").filter(Boolean).sort();
}

export function pluginHash(root = repo) {
  const hash = createHash("sha256");
  for (const file of pluginFiles(root)) {
    let bytes;
    try {
      bytes = readFileSync(join(root, file));
    } catch {
      continue; // deleted in the working tree
    }
    hash.update(`${file}\0`);
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function readRecord(root = repo) {
  return JSON.parse(readFileSync(join(root, RECORD), "utf8"));
}

if (import.meta.main) {
  const version = readFileSync(join(repo, "VERSION"), "utf8").trim();
  const sha256 = pluginHash();
  const record = readRecord();
  if (record.sha256 === sha256 && record.version === version) {
    console.log(`${RECORD} is current at ${version}`);
  } else if (record.version === version && !process.argv.includes("--amend")) {
    console.error(
      `${PLUGIN} changed but VERSION is still ${version}. Bump VERSION to the next -projects.N, add its CHANGES.md entry, run bun tools/generate.mjs, then rerun this.`,
    );
    process.exit(1);
  } else {
    writeFileSync(join(repo, RECORD), `${JSON.stringify({ version, sha256 }, null, 2)}\n`);
    console.log(`${RECORD} records ${version}`);
  }
}
