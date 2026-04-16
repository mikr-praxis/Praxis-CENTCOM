---
name: Session Preferences
description: How Mikr prefers sessions to be bootstrapped and how Claude should operate
type: feedback
originSessionId: 153d7d76-ae1f-470b-94ca-62a7f0119b80
---
Always use `/sessionstart` skill at the start of sessions to bootstrap context. Do NOT use scheduled tasks for session bootstrap — this was explicitly rejected in favor of manual skill invocation.

**Why:** Mikr wants control over when context loads. Scheduled tasks were creating nested task issues and felt too autonomous.

Push, deploy, and take action without asking for constant approval. Be autonomous with git operations (push, PR creation, deployments).

**Why:** User explicitly stated "you need to be able to push without my constant approval." Stopping to ask permission on routine git ops breaks flow.

**How to apply:** When starting a new session on the Praxis project, run `/sessionstart` if the user asks for it. Don't auto-schedule recurring bootstrap. Keep responses practical and concise — skip trailing summaries of what was just done (the user can read the diff). Push code, create PRs, and deploy without asking — just do it and report the result.
