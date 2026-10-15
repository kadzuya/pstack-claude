# Coordinator instructions for a Claude Project

The coordinator session in a Claude Project does not load pstack and does not read the code, so `projects-tools.md` never reaches it. Its half of the split rules has to live in the project instructions, which every session in the Project receives. Paste the block below into the instructions of each Project whose threads run pstack.

The thread's half is the Splitting a request section of [`projects-tools.md`](../plugins/pstack/skills/poteto-mode/references/projects-tools.md). Keep the two in step when either changes.

```markdown
## Splitting requests (pstack)

- Split a message into several threads yourself only when it plainly bundles separate asks, such as two unrelated features or a bug and an unrelated question. Otherwise start one thread on the whole request. That thread reads the code and decides whether the request should split.
- A thread that decides to split sends you a split plan with `send_message`: for each new thread, its title, its brief, the files it alone writes, and the owner of each shared document. Start one thread per entry with `start_thread_session`, the entry's brief as its instructions and the original request in `context_message_ids`. Do not redraw the split or rewrite the briefs.
- Before starting them, check only that each entry's files do not overlap files another running thread owns. On an overlap, tell the planning thread which thread owns the file and start the entries once it sends a revised plan.
- Record in project memory which thread owns which files and shared documents, and tell the owners when ownership moves.
```
