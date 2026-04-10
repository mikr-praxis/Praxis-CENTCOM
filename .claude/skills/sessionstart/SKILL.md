---
name: sessionstart
description: "Session bootstrap for Praxis CENTCOM â run this at the START of every new session. Clones the repo, loads all project context, logs into and verifies ALL connected services (GitHub, Vercel, Supabase, Gmail, Slack, Cloudflare, Monday.com, Google Calendar, Praxis-CENTCOM live site), opens Chrome, scans env vars, summarizes recent git history, and outputs a full status report so you can jump straight into work. Trigger on: /sessionstart, 'start session', 'bootstrap', 'new session', 'pick up where we left off', or any indication that the user is beginning a new working session on CENTCOM."
---

# /sessionstart â CENTCOM Session Bootstrap

You are bootstrapping a new working session on the Praxis Internal CENTCOM dashboard. Your job is to get everything online, log into every service, verify every connection, and give the user a single status report so they can start working immediately. Do NOT ask questions â just run everything and report back.

## Execution Sequence

Run these steps in order. Parallelize where possible (steps marked with â¡ can run concurrently).

### Step 1: Load Project Context

1. Invoke the `centcom` skill (full architecture, deploy process, troubleshooting)
2. Invoke the `praxis-context` skill (business context, team, clients)
3. Read `AGENTS.md` and `CLAUDE.md` from the repo root

### Step 2: Clone or Locate the Repo

Check if `Praxis-CENTCOM` is already cloned in the working directory. If not:

```bash
git clone https://github.com/mikr-praxis/Praxis-CENTCOM.git
```

Then confirm you're on `main` and the clone is clean.

### Step 3: Git Status & Recent History

```bash
git log --oneline -15
git status
git diff --stat HEAD~3..HEAD
```

Summarize: what was the last session's work? Current branch state? Any uncommitted changes?

### Step 4: â¡ Open Chrome & Log Into All Services (run in parallel where possible)

Open Chrome tabs and verify login status for EVERY service below. For each one, navigate to the service and confirm you're authenticated. If not logged in, flag it so the user can authenticate.

#### GitHub
- Navigate to `https://github.com/mikr-praxis/Praxis-CENTCOM`
- Verify: can see the repo, user is logged in (check for avatar/profile icon)

#### Vercel
- Navigate to `https://vercel.com/dashboard`
- Verify: logged in, can see the praxis-centcom project
- Check latest deployment status

#### Supabase
- Navigate to `https://supabase.com/dashboard/project/xnbsvfjkmpzoxrdhfpwx`
- Verify: logged in, can access the CENTCOM project

#### Cloudflare
- Navigate to `https://dash.cloudflare.com`
- Verify: logged in, dashboard accessible

#### Praxis-CENTCOM (Live Site)
- Navigate to `https://praxis-centcom.vercel.app`
- Verify: site loads, check if authenticated via Clerk

#### Monday.com
- Navigate to `https://praxisops.monday.com`
- Verify: logged in, boards accessible

### Step 5: â¡ Probe All Connected MCP Tools (run in parallel)

Check every MCP tool connection and report its status with a lightweight call:

#### Chrome
- Call `tabs_context_mcp` to confirm browser tools are connected
- Report: connected/disconnected, tabs open

#### Slack
- Search for a known user (e.g., "Mikr") or list channels
- Report: connected/disconnected, workspace accessible

#### Gmail
- Call `gmail_get_profile` to verify the connection
- Report: connected/disconnected, email address, message count

#### Google Calendar
- Call `gcal_list_calendars` to verify
- Report: connected/disconnected, which calendars are subscribed

### Step 6: â¡ Env Var Scan (can run parallel with Steps 4-5)

Grep the codebase for all referenced environment variables:

```bash
grep -roh 'process\.env\.\w\+' --include='*.ts' --include='*.tsx' | sort -u
```

List each one and flag whether it's a known configured var or potentially missing. Cross-reference with what's on the `/config` page if accessible.

### Step 7: Install Dependencies (if needed)

Check if `node_modules` exists. If not:

```bash
npm install
```

### Step 8: Output the Status Report

Format the report exactly like this:

```
âââââââââââââââââââââââââââââââââââââ
  /sessionstart â CENTCOM Status Report
âââââââââââââââââââââââââââââââââââââ

ð Date: [today's date]

ð Last session: [1-2 sentence summary of recent commits]

ð Git: [branch] â [clean/dirty] â [last commit hash + message]

ð Services:
  â¢ GitHub:        [â logged in / â needs login] â [details]
  â¢ Vercel:        [â logged in / â needs login] â [deploy status]
  â¢ Supabase:      [â logged in / â needs login] â [project status]
  â¢ Cloudflare:    [â logged in / â needs login] â [details]
  â¢ CENTCOM Live:  [â loaded / â down] â [site status]
  â¢ Monday.com:    [â logged in / â needs login] â [boards accessible]

ð MCP Tools:
  â¢ Chrome:    [â connected / â disconnected] â [details]
  â¢ Slack:     [â connected / â disconnected] â [details]
  â¢ Gmail:     [â connected / â disconnected] â [details]
  â¢ Calendar:  [â connected / â disconnected] â [details]

ð Env Vars: [X vars referenced, Y confirmed, Z flagged]

ð¦ Dependencies: [installed / needs install]

ð Skills loaded: centcom, praxis-context

â Ready to work.
âââââââââââââââââââââââââââââââââââââ
```

If any service needs login, list it clearly at the top so the user can authenticate. If something critical is broken (repo won't clone, site is down, major env vars missing), flag it prominently.

## Important Notes

- **Never ask the user questions during bootstrap.** Just run everything and report.
- **Speed matters.** Parallelize the tool checks and browser logins. The user ran this command because they want to get to work fast.
- **If a tool check or login fails**, report it as disconnected/needs login and move on. Don't retry or troubleshoot during bootstrap.
- **Open all browser tabs in the same Chrome window.** Use `tabs_create_mcp` for each service so the user has quick access to everything.
- **The centcom skill has the full architecture reference.** Don't repeat it in the status report â just confirm it's loaded.
