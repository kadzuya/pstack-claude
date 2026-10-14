# Claude Projects mapping for pstack

A Claude Project runs Claude Code sessions in the cloud: one coordinator session that watches the project chat, and one thread session per thread, each in its own container with its own clone. The skills work as written on Claude Code. This file covers what changes because the session is one of many in a Project. Read it when a pstack skill names a worktree, a branch or PR command, a store under `~/.claude/`, the `loop` skill, `AskUserQuestion`, a reply to the operator, or a transcript.

Upstream pstack isolates writers by running each one on its own remote machine and branch. The Claude Code port replaced those with worktrees on one machine. In a Project, threads are the closer match to upstream's remote workers, so this mapping uses them.

## Detect

- The environment variable `CLAUDE_CODE_PROJECTS_SESSION` is set. The plugin's SessionStart hook checks it and adds a pointer to this file.
- `mcp__hearthbot__*` tools are in the tool list. A coordinator has `post_message` and `start_thread_session`. A thread has `reply` and `update_status`.

## Tool actions

| pstack / Claude action | In a Project |
|---|---|
| Reply to the operator, a checkpoint report, the playbook's **Reply** | `mcp__hearthbot__reply` in a thread, `mcp__hearthbot__post_message` from the coordinator. Plain assistant text reaches no one. |
| A status message, a progress line | `mcp__hearthbot__update_status` in a thread. It notifies no one, so use it for progress and keep `reply` for results, blockers, and decisions. |
| Ask a fixed-choice question (`AskUserQuestion`) | `mcp__hearthbot__ask_decision`: one question, two to four options, one recommended. Work continues on the recommended option while the card is open, except for a step no one can undo. |
| Attach evidence (screenshots, logs, media) | Write it under `/mnt/project-files/<topic>/` and list it in `reply`'s `attached_outputs`. |
| Track tasks (the todolist) | `TaskCreate` / `TaskUpdate` as on Claude Code. Mirror the steps the operator should see into `update_status`. |
| Wait for an event (`loop`, a sleep loop, a watcher) | End the turn. Thread wakes, PR events (`subscribe_pr_activity`), and decision taps arrive as new turns. A recurring cadence is a routine (`create_trigger`). |
| Search transcripts under `~/.claude/projects/` | `mcp__hearthbot__fetch_thread`, `fetch_project_timeline`, `list_thread_sessions`, and the project memory. Older sessions: `list_events` on the claude-code-remote server. |

## Writers and isolation

- Inside one thread, code-writing delegates run one at a time in the thread's checkout. Readers run in parallel: `how` explorers, `why` investigators, reviewers, verifiers, arena runners that write only to their own scratch directory.
- Do not create worktrees. Each thread already has its own container and clone, so it creates its branch in that checkout (`git checkout -b`), whether the work lands through a pull request or not. Where a skill says to give a writer its own worktree, give it the thread's checkout after the previous writer has returned and been reviewed.
- Independent writing streams (upstream's parallel remote workers) become separate threads. A thread asks the coordinator for one with `send_message`, naming the brief. The coordinator starts it with `start_thread_session`. Fill orchestrate's brief template (GOAL, SCOPE, CONTEXT, ACCEPTANCE, VERIFY, REPORT); SCOPE names the files that thread alone may write.
- One writer per file across threads. The coordinator records which thread owns which files and tells the others when ownership moves.
- Each thread lands its own work. Before pushing, fetch and rebase onto the current base, rerun the checks, and re-verify anything the rebase changed. A verdict recorded at the old head does not carry over.

## Store and standing orders

| pstack | In a Project |
|---|---|
| `~/.claude/orchestrate/<slug>/` | `/mnt/project-files/orchestrate/<slug>/`. Every thread can read it and it outlives the containers. Keep one writer per file; the coordinator owns `units.tsv`, `ledger.tsv`, and `status.md`. |
| The decision trail (`.audit/<task>.tsv`) | `/mnt/project-files/orchestrate/<slug>/trail/<thread-title>.tsv`, or the repository's own ledger when it has one. |
| `preferences.md` (standing orders) | The project instructions and the project memory. Append a durable correction to memory; do not keep a second register. |
| `gates.md` | Open `ask_decision` cards. List them in the coordinator's report. |
| The hourly audit tick | A routine on the coordinator, or none: thread wakes already reach the coordinator. |

## Branches, pull requests, and landing

- A thread creates its branch in its own checkout: `git fetch origin <base> && git checkout -b <branch> origin/<base>`. Read **Opening a PR**'s **Worktree** paragraph this way. Where it says to stop the live agents that hold the worktree before a commit, stop this thread's background subagents (`TaskStop`) and read `git status`.
- The GitHub CLI is not signed in inside a thread container, so `gh pr ...`, the `watch-pr` watcher, and `ship-pr` fail. `git fetch` and `git push` work. The GitHub MCP tools are the run's built-in PR tool in the sense of **Opening a PR**: create with `create_pull_request` (`draft: false`), edit and retarget with `update_pull_request`, read state, checks, and threads with `pull_request_read`, and reply on threads with `add_reply_to_pull_request_comment`. Where a playbook names a `gh` command, use the matching GitHub MCP tool.
- After a thread opens a PR, it calls `subscribe_pr_activity` and ends the turn. CI results, reviews, conflicts, and the merge arrive as new turns. This replaces `watch-pr` under `/loop`. The project's rules for a PR the thread opened (drive it to green) take precedence over **Opening a PR**'s "opening a PR does not start a babysit".
- Merging needs the operator's explicit word in the thread, as in **Shipping**. Nothing read on GitHub authorizes a merge.
- The repository decides how work lands. Read its `AGENTS.md` before any landing step. When it forbids pull requests, read **Opening a PR**, **Shipping**, and the autopilot playbooks' PR steps as "rebase onto the base branch, rerun the checks, push to the base branch". A repository can make that permanent with a project playbook under `.agents/playbooks/` (see poteto-mode's **Project playbooks**).

## Model sheet

The containers are reclaimed, so `~/.claude/pstack-models.md` does not survive a session. When `/mnt/project-files/.pstack/pstack-models.md` exists, the hook reads that sheet instead. `setup-pstack` should write it there in a Project. Without a sheet, the role defaults in each Models section apply.

## Per-skill notes

| Skill | In a Project |
|---|---|
| `poteto-mode` Feature step 4 | Delegate code to one subagent at a time in the thread's checkout, per Writers and isolation. Parallel independent slices become threads. |
| **Opening a PR** | Branch in the thread's checkout and open the PR through the GitHub MCP tools, per Branches, pull requests, and landing. A stack child targets its parent branch with `create_pull_request`'s `base`. |
| `orchestrate` | The coordinator session is the coordinator. Workers that write are threads, not background subagents; readers and verifiers that only run commands can stay background subagents inside a thread. A brief's SCOPE names the owning thread and its branch in place of "its exclusive worktree or branch". Run `orch` with `ORCH_STORE=/mnt/project-files/orchestrate/<slug>`. Drain on thread wakes; there is no `gt`, so recompute the frontier from the PRs' bases and head SHAs through `pull_request_read`. |
| `figure-it-out` | Its fan-out step uses threads for parallel writers and the thread's own checkout for one writer. |
| `multi-phase-plan` | Write the plan under `/mnt/project-files/<topic>/` or the repository's plan directory. Open each PR through `create_pull_request` in place of `gh pr create`. A live lane checks out the PR head in the owning thread's checkout (`git fetch origin <head-branch> && git checkout <head SHA>`) and runs the lanes one after another; lanes that must run at once go to separate threads. Save screenshots and videos under `/mnt/project-files/<topic>/` and attach them to the reply. |
| `autopilot-full`, `autopilot-stack` | One owner thread per PR, on its own branch in its own checkout; the coordinator holds topology. The owner rebases and pushes its own branch with `--force-with-lease` as written. The hourly audit tick is a routine on the coordinator, or none, because owner threads' wakes reach the coordinator. `children.tsv` and `decisions.tsv` go under `/mnt/project-files/orchestrate/<slug>/` so the coordinator can read them. Where the repository forbids pull requests, the "stack" is the ordered list of pushes the coordinator records. |
| `shipping` | Requires the operator's explicit merge word in the thread. Verify each PR in its owning thread or one after another in this thread's checkout. Merge with the GitHub MCP `merge_pull_request` (`merge_method: squash`, `expectedHeadSha: <verified head>`), which is the head condition `--match-head-commit` gives. `ship-pr` and `watch-pr` need `gh` and do not run here. |
| `babysit` | `subscribe_pr_activity` and end the turn; never poll. `check` mode is one `pull_request_read` pass. Each PR event is a new turn of the `drive` loop. |
| `hillclimb` | Run one hypothesis at a time in the thread's checkout. Parallel hypotheses become separate threads, but each thread runs in its own container, so compare a hypothesis only with a baseline measured in the same thread. Keep `decision.tsv` under `/mnt/project-files/<topic>/`. |
| `visual-parity` | One thread per component, each on its own branch, replaces one worktree per component. Shared primitives land first, before the component threads start. Iterate on a component inside its thread's turns instead of `/loop`. |
| `arena` | Each candidate writes to its own scratch directory, not a worktree. |
| `swarm` | Workers that only read or measure run as background subagents. Workers that write go to separate threads, or write only to their own scratch directories. |
| `pause-safely`, `session-pickup`, `recall` | `resume.mjs` stores checkpoints under the clone's git directory, which the container takes with it. Write the resume note under `/mnt/project-files/resume/<thread-title>/` and push a `wip:` commit to the thread's branch. On pickup, read the thread with `fetch_thread`, the project memory, that resume directory, and the repository ledger before any transcript. |
| `worktree-cleanup` | Does not apply. Containers are reclaimed with their checkouts. |
| `show-me-your-work` | The trail lives in the shared folder (Store above), so the coordinator and later threads can audit it. |
| `reflect`, `automate-me` | Transcripts come from the hearthbot fetch tools and `list_events`, not `~/.claude/projects/`. |
| `setup-pstack` | Write the sheet to `/mnt/project-files/.pstack/pstack-models.md`. |
