# Claude Projects mapping for pstack

A Claude Project runs Claude Code sessions in the cloud: one coordinator session that watches the project chat, and one thread session per thread, each in its own container with its own clone. The skills work as written on Claude Code. This file covers what changes because the session is one of many in a Project. Read it when a pstack skill names a worktree, a store under `~/.claude/`, the `loop` skill, `AskUserQuestion`, a reply to the operator, or a transcript.

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
- Do not create worktrees for delegates unless the repository's own instructions allow them. Where a skill says to give a writer its own worktree, give it the thread's checkout after the previous writer has returned and been reviewed.
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

## Repository conventions

The repository decides how work lands. Read its `AGENTS.md` before any landing step. When it forbids pull requests, read **Opening a PR**, **Shipping**, and the autopilot playbooks' PR steps as "rebase onto the base branch, rerun the checks, push to the base branch". A repository can make that permanent with a project playbook under `.agents/playbooks/` (see poteto-mode's **Project playbooks**).

## Model sheet

The containers are reclaimed, so `~/.claude/pstack-models.md` does not survive a session. When `/mnt/project-files/.pstack/pstack-models.md` exists, the hook reads that sheet instead. `setup-pstack` should write it there in a Project. Without a sheet, the role defaults in each Models section apply.

## Per-skill notes

| Skill | In a Project |
|---|---|
| `poteto-mode` Feature step 4 | Delegate code to one subagent at a time in the thread's checkout, per Writers and isolation. Parallel independent slices become threads. |
| `orchestrate` | The coordinator session is the coordinator. Workers are threads, not background subagents. The store is under `/mnt/project-files/orchestrate/`. Drain on thread wakes. |
| `figure-it-out` | Its fan-out step uses threads for parallel writers and the thread's own checkout for one writer. |
| `multi-phase-plan` | Write the plan under `/mnt/project-files/<topic>/` or the repository's plan directory. Live lanes run through the repository's verification skill inside the owning thread. |
| `autopilot-full`, `autopilot-stack` | One owner thread per unit. The coordinator holds topology. Where the repository forbids pull requests, the "stack" is the ordered list of pushes the coordinator records. |
| `swarm` | Workers that only read or measure run as background subagents. Workers that write go to separate threads, or write only to their own scratch directories. |
| `babysit` | `subscribe_pr_activity` and end the turn; never poll. |
| `session-pickup`, `recall` | Read the thread with `fetch_thread`, the project memory, and the repository ledger before any transcript. |
| `show-me-your-work` | The trail lives in the shared folder (Store above), so the coordinator and later threads can audit it. |
| `reflect`, `automate-me` | Transcripts come from the hearthbot fetch tools and `list_events`, not `~/.claude/projects/`. |
| `setup-pstack` | Write the sheet to `/mnt/project-files/.pstack/pstack-models.md`. |
