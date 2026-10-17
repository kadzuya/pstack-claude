# Claude Projects fork

This fork ([kadzuya/pstack-claude](https://github.com/kadzuya/pstack-claude)) adds a Claude Projects layer on top of [michael-denyer/pstack-claude](https://github.com/michael-denyer/pstack-claude). Everything else tracks that repository.

## Why

Upstream pstack isolates parallel writers by running each one on its own remote machine and branch. pstack-claude runs on one Claude Code machine, so it turned those writers into worktrees, keeps its store under `~/.claude/orchestrate/`, and runs audits with `/loop`. A Claude Project already has the closer match: each thread is its own container and clone, so a thread creates its branch in its own checkout and needs no worktree, even for pull-request work; `/mnt/project-files` is shared and outlives every container, routines replace `/loop`, and decision cards replace `AskUserQuestion`. The fork maps the skills onto those, without rewriting upstream text.

## What the fork changes

| File | Change |
|---|---|
| `plugins/pstack/skills/poteto-mode/references/projects-tools.md` | New. The Projects mapping: tool actions, splitting a request, writers and isolation, store and standing orders, repository conventions, model sheet, per-skill notes. |
| `plugins/pstack/hooks/session-start.sh` | When `CLAUDE_CODE_PROJECTS_SESSION` is set, prints `session-start-projects.md` after the routing mandate, and reads the model sheet from `/mnt/project-files/.pstack/pstack-models.md` when that file exists. |
| `plugins/pstack/hooks/session-start-projects.md` | New. Tells the session to read `projects-tools.md` before any pstack skill. |
| `docs/projects-coordinator.md` | New. The coordinator's half of the split rules, to paste into the project instructions, since the coordinator does not load pstack. |
| `tools/fork-version.mjs`, `tools/fork-version.json`, `tests/fork-version.test.mjs` | New. Record a hash of every file under `plugins/pstack` at the current VERSION, and fail the tests when the plugin changes under the same VERSION. |
| `tools/parent-merge.mjs`, `tests/parent-merge.test.mjs` | New. Merge pstack-claude's main and resolve the conflicts each of its releases brings (Keeping up with pstack-claude). |
| `tools/generate.mjs` | Accepts a `-projects.N` suffix on VERSION and on CHANGES.md headings. Two regular expressions, each marked with a comment naming this fork. |

The three plugin files are port-only files, so `tools/sync.mjs` never merges them and `tools/forks.json` needs no entry. Keep it that way: put Projects behaviour in the mapping, not in edits to upstream-derived skill text. If an upstream-derived file must change, declare it in `tools/forks.json` as a `port-feature`. The fork's own tools and tests are port-only too; `tools/generate.mjs` is the one file outside the plugin that the fork edits, and the table above is its record.

Naming: in this repository "upstream" means cursor/plugins, which pstack-claude pulls with `tools/sync.mjs` (`tools/upstream.json`). This fork calls pstack-claude the **parent**, and its git remote `parent`. The fork never runs `tools/sync.mjs`; it receives the parent's syncs by merging.

## Versioning

Claude Code caches an installed plugin under its version and updates it only when the version changes, so a change that keeps the version never reaches an installed copy. The fork's VERSION is `<parent VERSION>-projects.<N>`. Every change under `plugins/pstack` bumps N in the same PR:

1. Edit `VERSION`, and add a `## <version> - <title>` entry at the top of `CHANGES.md`.
2. `bun tools/generate.mjs` stamps the manifests.
3. `bun tools/fork-version.mjs` records the new hash. Before the PR merges, a review fix to the plugin reruns it with `--amend`.

A merge of a new parent release resets N to 1 (`0.9.91-projects.1`). `docs/` does not ship in the plugin, so a change there alone needs no bump.

In semver a prerelease sorts below its release, so `0.9.90-projects.1` is "older" than `0.9.90`. Claude Code's `plugin update` moves on any change of version, not only to a higher one (checked with 2.1.302), and the fork never publishes a plain parent version, so this does not hold an update back.

## Keeping up with pstack-claude

```sh
bun tools/parent-merge.mjs     # adds and fetches the `parent` remote, merges parent/main
bun test tests/
```

Every parent release conflicts with the fork in the same seven files: `VERSION`, the five manifests the generator stamps from it, and the top of `CHANGES.md`. `tools/parent-merge.mjs` resolves those: it takes the parent's manifests, sets VERSION to `<parent VERSION>-projects.1`, puts a fork entry above the parent's new CHANGES entries, runs the generator and `tools/fork-version.mjs`, and commits the merge. Any other conflict, such as the Projects branch of `session-start.sh` or the two lines in `tools/generate.mjs`, stops it with the merge in progress, to resolve by hand. GitHub's Sync fork button cannot resolve conflicts, so do not use it.

Merge the parent in a PR of its own, not inside a feature PR. After each merge, check that `projects-tools.md` still matches what the merged playbooks say (worktree rules in Feature, the orchestrate store, the autopilot PR steps). A weekly scheduled Claude session in the fork's Project does both.

## Status (2026-10-14)

- Done: the mapping, the hook branch, generator and tests pass. The per-skill notes cover every playbook that asks for a worktree, a branch, or a PR command.
- Found in a real thread: `CLAUDE_CODE_PROJECTS_SESSION` is set, and the GitHub CLI is not signed in, so PR work goes through the GitHub MCP tools.
- Not yet verified: that a real Project thread with the plugin installed reads the mapping and follows it.
- Next: install the fork in a Project (marketplace `kadzuya/pstack-claude`, plugin `pstack@pstack-claude`, project scope in `.claude/settings.json`) and paste `projects-coordinator.md`'s block into its instructions, run one real feature through it, fix the mapping from what goes wrong, then add a scheduled session that merges `parent/main` on a cadence. Once it holds up, consider proposing the mapping to pstack-claude as a Projects runtime note.
