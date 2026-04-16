---
name: Integrations Status
description: Which third-party integrations are live, pending, or blocked — updated 2026-04-14
type: project
originSessionId: 153d7d76-ae1f-470b-94ca-62a7f0119b80
---
**Live:**
- Slack (@slack/web-api) — bot token in Vercel, channels/messages/send working
- Gmail — via MCP connector, mscott@builtbypraxis.com
- Google Calendar — via MCP connector, GCP service account key deployed to Vercel
- Supabase — full CRUD, realtime subscriptions
- Upstash Redis — connected
- PostHog — analytics tracking active
- Clerk — auth, middleware protecting all app routes

**Pending (not yet configured):**
- Monday.com — MCP connector available but not wired in
- ActiveCampaign — CRM integration planned
- HubSpot — marketing pipeline sync planned

**Blocked:**
- ANTHROPIC_API_KEY not set in Vercel env vars — blocks AI Agents feature (9 agents defined but can't execute)
- Ops calendar needs to be shared with service account `praxis-centcom-calendar@unified-atom-492422-n5.iam.gserviceaccount.com`

**Why:** Tracking this avoids re-discovering blockers each session.

**How to apply:** Before working on any integration feature, check this list first. Update when status changes.
