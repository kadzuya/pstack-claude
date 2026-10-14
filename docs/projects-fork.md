# Claude Projects fork

This fork ([kadzuya/pstack-claude](https://github.com/kadzuya/pstack-claude)) adds a Claude Projects layer on top of [michael-denyer/pstack-claude](https://github.com/michael-denyer/pstack-claude). Everything else tracks that repository.

## Why

Upstream pstack isolates parallel writers by running each one on its own remote machine and branch. pstack-claude runs on one Claude Code machine, so it turned those writers into worktrees, keeps its store under `~/.claude/orchestrate/`, and runs audits with `/loop`. A Claude Project already has the closer match: each thread is its own container and clone, `/mnt/project-files` is shared and outlives every container, routines replace `/loop`, and decision cards replace `AskUserQuestion`. The fork maps the skills onto those, without rewriting upstream text.

## What the fork changes

| File | Change |
|---|---|
| `plugins/pstack/skills/poteto-mode/references/projects-tools.md` | New. The Projects mapping: tool actions, writers and isolation, store and standing orders, repository conventions, model sheet, per-skill notes. |
| `plugins/pstack/hooks/session-start.sh` | When `CLAUDE_CODE_PROJECTS_SESSION` is set, prints `session-start-projects.md` after the routing mandate, and reads the model sheet from `/mnt/project-files/.pstack/pstack-models.md` when that file exists. |
| `plugins/pstack/hooks/session-start-projects.md` | New. Tells the session to read `projects-tools.md` before any pstack skill. |

All three are port-only files, so `tools/sync.mjs` never merges them and `tools/forks.json` needs no entry. Keep it that way: put Projects behaviour in the mapping, not in edits to upstream-derived skill text. If an upstream-derived file must change, declare it in `tools/forks.json` as a `port-feature`.

## Keeping up with pstack-claude

```sh
git remote add upstream https://github.com/michael-denyer/pstack-claude
git fetch upstream main
git merge upstream/main
bun tools/generate.mjs && bun test tests/
```

A conflict can only come from `session-start.sh`. After each merge, check that `projects-tools.md` still matches what the merged playbooks say (worktree rules in Feature, the orchestrate store, the autopilot PR steps).

## Status (2026-10-14)

- Done: the mapping, the hook branch, generator and tests pass.
- Not yet verified: that a real Project thread with the plugin installed reads the mapping and follows it.
- Next: install the fork in a Project (marketplace `kadzuya/pstack-claude`, plugin `pstack@pstack-claude`, project scope in `.claude/settings.json`), run one real feature through it, fix the mapping from what goes wrong, then add a routine that merges `upstream/main` on a cadence. Once it holds up, consider proposing the mapping to pstack-claude as a Projects runtime note.

## First consumer

[kadzuya/musical-game](https://github.com/kadzuya/musical-game) commits directly to `main` with no pull requests, and its `AGENTS.md` forbids worktrees without the owner's consent. It will add project playbooks under `.agents/playbooks/` that replace the PR steps with "rebase, rerun checks, push to main" and point verification at its own `verify` skill. Design notes from that project: `/mnt/project-files/pstack-adoption/` in the musical-game Claude Project.
