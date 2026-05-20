---
name: Testing Mode — until `deploylivecentcom`
description: Hard rule for the duration of this and future sessions on Praxis-CENTCOM. The owner explicitly stated they are TESTING until they issue the command `deploylivecentcom`. Until that command lands in chat verbatim, treat everything as non-final.
type: project
priority: hard-rule
originSessionId: configure-kpis-data-sources-WPZJk
---

## The rule

We are in **TESTING MODE** for the Praxis-CENTCOM project until the owner
types the literal command `deploylivecentcom` in chat. This is a session-
scoped flag that overrides default behavior around merging + deploying.

## What this changes

1. **Prompt before every push.** ANY `git push`, `mcp__github__push_files`,
   `mcp__github__create_or_update_file`, PR creation, or PR merge requires
   an explicit per-action confirmation in chat. The agent never assumes the
   owner wants the change shipped just because CI is green or the work is
   done — it always asks first. Default action when no confirmation has
   been received: leave the change local / unpushed.

2. **Do NOT merge PRs to `main` without explicit per-PR approval.** Even
   when CI is green and the change looks complete, the default action is
   to leave the PR open. The owner reviews the preview deploy and tells
   you when to merge. The merge happens only when they say "merge" (or
   equivalent) for a specific PR.

3. **Do NOT push directly to `main`** for anything that ships product
   code. CI config and tracking-issue plumbing are the only exceptions
   (these don't change product behavior) — and even those should still
   prompt per rule #1.

4. **Treat live data as fixture data**, not customer data. Don't take
   irreversible actions against connected services (Stripe charges,
   HubSpot contacts, Meta/Google ad accounts) without per-action
   confirmation.

5. **Vercel production URL is the testing surface**, not the customer-
   facing site. The owner is the only user during this window.

## What ends testing mode

Exactly this string typed by the owner: `deploylivecentcom`

When that lands, normal defaults resume:
- Green PRs may be auto-merged at the agent's discretion if the owner
  has previously approved the work
- The merge → deploy → customer cycle is back to default
- Update this file with a "Testing mode ended on <date>" footer

## Why this exists

The owner explicitly stated they want testing space before customer
hand-off. Codifying it here means every session inherits the same
guard rail without having to re-establish it in chat each time.
