#!/usr/bin/env bun
// Merges the parent repository (michael-denyer/pstack-claude, the git remote
// `parent`) into the kadzuya fork, and resolves the conflicts every parent
// release brings: VERSION, the manifests the generator stamps, and the top of
// CHANGES.md. Any other conflict stops the run with the merge left in
// progress, for a person or a thread to resolve. "Upstream" in this repo means
// cursor/plugins (tools/upstream.json), which tools/sync.mjs pulls on the
// parent's side; the fork never runs that sync itself.
//
// Usage: bun tools/parent-merge.mjs [<ref>]   (default parent/main)
// It adds and fetches the `parent` remote when <ref> starts with "parent/",
// commits the merge with git's configured identity, and does not push.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { RUNTIMES } from "./runtimes.mjs";
import { PLUGIN } from "./plugin.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const PARENT_URL = "https://github.com/michael-denyer/pstack-claude";

// The generator restamps these from VERSION, so the parent's text is safe to take.
const STAMPED = [".claude-plugin/marketplace.json", `${PLUGIN}/.claude-plugin/plugin.json`, ...RUNTIMES.map((r) => r.manifest)];

function git(args, { allowFail = false } = {}) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (result.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr}${result.stdout}`);
  }
  return result;
}

const out = (args) => git(args).stdout.trim();
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: repo, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
};

export function parseVersion(version) {
  const match = version.trim().match(/^(\d+\.\d+\.\d+)(?:-projects\.(\d+))?$/);
  if (!match) throw new Error(`unreadable VERSION "${version.trim()}"`);
  return { base: match[1], n: match[2] ? Number(match[2]) : 0 };
}

// The fork's next VERSION: a new parent release restarts N at 1, and a
// parent change to the plugin under an unchanged release moves N on.
export function nextVersion(ours, theirs, pluginChanged) {
  const fork = parseVersion(ours);
  const parent = parseVersion(theirs);
  if (parent.base !== fork.base) return `${parent.base}-projects.1`;
  if (pluginChanged) return `${fork.base}-projects.${fork.n + 1}`;
  return ours.trim();
}

// Each conflict hunk in CHANGES.md is two runs of new entries at the top of
// the file. The parent's newer releases go first, then the fork's entries.
export function resolveChanges(text) {
  return text.replace(/^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm, (_, ours, theirs) => {
    const sep = theirs.endsWith("\n\n") || !theirs ? "" : "\n";
    return `${theirs}${sep}${ours}`;
  });
}

function main() {
  const ref = process.argv[2] ?? "parent/main";
  if (out(["status", "--porcelain"])) throw new Error("commit or stash local changes first");
  if (ref.startsWith("parent/")) {
    if (git(["remote", "get-url", "parent"], { allowFail: true }).status !== 0) git(["remote", "add", "parent", PARENT_URL]);
    git(["fetch", "parent", ref.slice("parent/".length)]);
  }
  if (git(["merge-base", "--is-ancestor", ref, "HEAD"], { allowFail: true }).status === 0) {
    console.log(`${ref} is already merged`);
    return;
  }

  const ours = readFileSync(join(repo, "VERSION"), "utf8");
  const theirs = out(["show", `${ref}:VERSION`]);
  const pluginChanged = Boolean(out(["diff", "--name-only", `HEAD...${ref}`, "--", PLUGIN]));
  const version = nextVersion(ours, theirs, pluginChanged);

  git(["merge", "--no-commit", "--no-ff", ref], { allowFail: true });
  const conflicted = out(["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean);
  const left = conflicted.filter((file) => file !== "VERSION" && file !== "CHANGES.md" && !STAMPED.includes(file));
  if (left.length) {
    console.error(`Resolve these by hand, then rerun the generator and tests (merge left in progress):\n  ${left.join("\n  ")}`);
    process.exit(1);
  }
  for (const file of conflicted.filter((file) => STAMPED.includes(file))) git(["checkout", "--theirs", "--", file]);

  const changesPath = join(repo, "CHANGES.md");
  let changes = resolveChanges(readFileSync(changesPath, "utf8"));
  if (version !== ours.trim()) {
    const heading = `## ${version} - merge pstack-claude ${parseVersion(theirs).base} (kadzuya fork)`;
    const entry = `${heading}\n\nThis release merges pstack-claude ${parseVersion(theirs).base}, whose entries follow, under the fork's Projects layer.\n\n`;
    changes = changes.replace(/^## /m, `${entry}## `);
  }
  writeFileSync(changesPath, changes);
  writeFileSync(join(repo, "VERSION"), `${version}\n`);

  run("bun", ["tools/generate.mjs"]);
  run("bun", ["tools/fork-version.mjs"]);
  git(["add", "-A"]);
  git(["commit", "--no-edit", "-m", `Merge ${ref} (${theirs.trim()}) as ${version}`]);
  console.log(`Merged ${ref} as ${version}. Run bun test tests/, then push.`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
