---
name: Pull Latest Before Starting Work
description: Always fetch and rebase onto latest main before starting any work — never assume the worktree is current
type: feedback
originSessionId: 153d7d76-ae1f-470b-94ca-62a7f0119b80
---
ALWAYS run `git fetch origin && git rebase origin/main` (or check `git log origin/main`) at the START of every session before writing any code. Never assume the current branch/worktree reflects the latest state of main.

**Why:** On 2026-04-14 I built an entire Projects module on a stale worktree (branched from an old commit), only to discover main had already built a far more advanced version with milestones, Monday.com integration, kanban trackers, and role-based sidebar. Everything I built was already superseded. The user was rightfully frustrated.

**How to apply:**
- Session start: check `git log origin/main -10` and diff against the current branch
- Before opening any plan: verify the files you intend to change haven't already been rewritten upstream
- If the worktree is more than a day or two old, rebase first
- The `/sessionstart` skill should verify this — if it doesn't already, update it
