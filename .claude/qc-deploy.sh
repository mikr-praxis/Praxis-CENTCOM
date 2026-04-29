#!/usr/bin/env bash
# .claude/qc-deploy.sh — Pre-commit QC for CentCom.
#
# Runs deterministic checks against the staged + committed-but-unpushed work,
# then prints a deployment report. Wired as a PreToolUse hook on `git commit`
# in .claude/settings.json — if any check fails, exit 2 blocks the commit and
# the report is shown to Claude.
#
# Designed to run in the local sandbox WITHOUT Node/npm (per project memory),
# so all checks are pure bash/grep/git. The `qc-deploy` subagent at
# .claude/agents/qc-deploy.md does the slower semantic review.
#
# Hook input on stdin (PreToolUse for Bash):
#   { "tool_name": "Bash", "tool_input": { "command": "git commit -m ..." } }
# When run from the hook, we only run the checks if the command is a commit.

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$REPO_ROOT" ] && { echo "Not in a git repo, skipping QC"; exit 0; }
cd "$REPO_ROOT"

# When invoked from a hook, stdin carries JSON. When invoked manually (no
# stdin), $-/argv decides. We accept both.
HOOK_INPUT=""
if [ ! -t 0 ]; then
  HOOK_INPUT="$(cat || true)"
fi

# Extract the bash command if we got hook JSON. Skip if not a `git commit`.
if [ -n "$HOOK_INPUT" ]; then
  CMD="$(printf '%s' "$HOOK_INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  case "$CMD" in
    *"git commit"*)
      ;; # proceed
    *)
      exit 0 # not a commit, skip QC
      ;;
  esac
fi

REPORT="$REPO_ROOT/.claude/last-qc-report.md"
mkdir -p "$(dirname "$REPORT")"

# Buffer report so it ends up in BOTH stderr (visible to Claude on hook block)
# and on disk for review.
BUF="$(mktemp)"
trap 'rm -f "$BUF"' EXIT

write() { printf '%s\n' "$@" >>"$BUF"; }

FAIL=0
WARN=0

write "# QC Deployment Report"
write "_$(date -u +'%Y-%m-%dT%H:%M:%SZ')_  •  branch \`$(git branch --show-current)\`"
write ""

# Determine compare base. Prefer origin/main; fall back to main; last to HEAD~10.
BASE="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD~10)"

# ───────────────────────── 1. Diff scope ─────────────────────────
write "## Scope of changes (vs \`origin/main\`)"
write '```'
git diff --stat "$BASE"..HEAD 2>/dev/null | tail -200 >>"$BUF" || write "(no diff)"
write '```'
write ""

CHANGED_TS=$(git diff --name-only "$BASE"..HEAD -- '*.ts' '*.tsx' 2>/dev/null)
CHANGED_SQL=$(git diff --name-only --diff-filter=A "$BASE"..HEAD -- 'supabase/migrations/*.sql' 2>/dev/null)
CHANGED_API=$(git diff --name-only "$BASE"..HEAD -- 'app/api/*' 2>/dev/null)
CHANGED_LIB=$(git diff --name-only "$BASE"..HEAD -- 'lib/*' 2>/dev/null)

# ───────────────────────── 2. Migration sanity ─────────────────────────
write "## Migrations"
# Only flag duplicate prefixes if at least ONE of the colliding files is new in
# this diff. Pre-existing collisions in main are out of scope for a pre-commit
# QC — flag them once at session start, not on every commit.
NEW_PREFIXES=$(echo "$CHANGED_SQL" | sed -n 's|.*/\([0-9][0-9]*\)_.*|\1|p' | sort -u)
ALL_PREFIXES=$(ls supabase/migrations/*.sql 2>/dev/null | sed -n 's|.*/\([0-9][0-9]*\)_.*|\1|p' | sort)
NEW_DUPES=""
for prefix in $NEW_PREFIXES; do
  count=$(echo "$ALL_PREFIXES" | grep -cx "$prefix" || true)
  if [ "${count:-0}" -gt 1 ]; then
    NEW_DUPES="$NEW_DUPES $prefix"
  fi
done
if [ -n "$NEW_DUPES" ]; then
  write "**❌ New migration collides with existing prefix:**$NEW_DUPES"
  write ""
  write "Rename the new file to the next available number."
  FAIL=1
fi
if [ -n "$CHANGED_SQL" ]; then
  write "**⚠️ New migrations in this diff (require manual Supabase SQL Editor run):**"
  echo "$CHANGED_SQL" | sed 's|^|- `|;s|$|`|' >>"$BUF"
  WARN=1
fi
if [ -z "$CHANGED_SQL" ]; then
  write "✅ No new migrations in this diff."
fi
write ""

# ───────────────────────── 3. Env vars ─────────────────────────
write "## Env vars referenced in changed code"
if [ -n "$CHANGED_TS" ]; then
  REFS=$(echo "$CHANGED_TS" | xargs grep -h "process\.env\." 2>/dev/null | \
         sed -n 's/.*process\.env\.\([A-Z_][A-Z_0-9]*\).*/\1/p' | sort -u)
  if [ -n "$REFS" ]; then
    KNOWN_FILE="$REPO_ROOT/.claude/qc-checks/known-env-vars.txt"
    if [ -f "$KNOWN_FILE" ]; then
      UNKNOWN=$(comm -23 <(echo "$REFS" | sort -u) <(sort -u "$KNOWN_FILE") || true)
      if [ -n "$UNKNOWN" ]; then
        write "**⚠️ New env vars not in the known set:**"
        echo "$UNKNOWN" | sed 's|^|- `|;s|$|`  ← add to Vercel before deploy if not already there|' >>"$BUF"
        write ""
        write "_All vars referenced:_"
        echo "$REFS" | sed 's|^|- `|;s|$|`|' >>"$BUF"
        WARN=1
      else
        write "✅ All referenced env vars are in the known set:"
        echo "$REFS" | sed 's|^|- `|;s|$|`|' >>"$BUF"
      fi
    else
      write "(known-env-vars.txt missing — listing all references)"
      echo "$REFS" | sed 's|^|- `|;s|$|`|' >>"$BUF"
    fi
  else
    write "(no \`process.env.X\` references in changed code)"
  fi
else
  write "(no .ts/.tsx changes)"
fi
write ""

# ───────────────────────── 4. Import path verification ─────────────────────────
write "## Import path verification"
BROKEN_IMPORTS=""
if [ -n "$CHANGED_TS" ]; then
  while IFS= read -r file; do
    [ -f "$file" ] || continue
    # Match imports like `from '@/path/to/foo'` and `from './foo'`
    grep -nE "from\s+['\"](@/[^'\"]+|\\./[^'\"]+|\\.\\./[^'\"]+)['\"]" "$file" 2>/dev/null | \
      while IFS=: read -r lineno _line; do
        path=$(printf '%s' "$_line" | sed -n "s/.*from[[:space:]]*['\"]\([^'\"]\+\)['\"].*/\1/p")
        # Resolve @ -> repo root
        if [ "${path#@/}" != "$path" ]; then
          resolved="$REPO_ROOT/${path#@/}"
        else
          dir=$(dirname "$file")
          resolved="$dir/$path"
        fi
        # Try common extensions + index files
        found=""
        for ext in "" ".ts" ".tsx" ".js" ".jsx" "/index.ts" "/index.tsx" "/index.js"; do
          if [ -e "${resolved}${ext}" ]; then
            found=1
            break
          fi
        done
        if [ -z "$found" ]; then
          printf '%s:%s -> %s\n' "$file" "$lineno" "$path"
        fi
      done
  done <<<"$CHANGED_TS" >/tmp/qc-broken-imports.$$
  BROKEN_IMPORTS=$(cat /tmp/qc-broken-imports.$$ 2>/dev/null)
  rm -f /tmp/qc-broken-imports.$$
fi
if [ -n "$BROKEN_IMPORTS" ]; then
  write "**❌ Imports referencing missing paths:**"
  write '```'
  echo "$BROKEN_IMPORTS" >>"$BUF"
  write '```'
  FAIL=1
else
  write "✅ All relative + @-aliased imports resolve."
fi
write ""

# ───────────────────────── 5. Integration touch-points ─────────────────────────
INTEG_FILE="$REPO_ROOT/.claude/qc-checks/integrations.json"
if [ -f "$INTEG_FILE" ] && [ -n "$CHANGED_TS$CHANGED_LIB" ]; then
  write "## Integrations touched in this diff"
  TOUCHED=""
  # crude JSON parse: name + first code_pattern
  while read -r line; do
    name=$(echo "$line" | sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    [ -z "$name" ] && continue
    patterns=$(grep -A4 "\"name\": \"$name\"" "$INTEG_FILE" | sed -n 's/.*"code_patterns"[[:space:]]*:[[:space:]]*\[\([^]]*\)\].*/\1/p' | tr ',' '\n' | sed 's/[" ]//g' | grep -v '^$')
    hit=""
    for pat in $patterns; do
      if [ -n "$CHANGED_TS" ]; then
        if echo "$CHANGED_TS" | xargs grep -l -F "$pat" 2>/dev/null | head -1 | grep -q .; then
          hit=1
          break
        fi
      fi
    done
    if [ -n "$hit" ]; then
      TOUCHED="${TOUCHED}- **${name}**\n"
      notes=$(grep -A6 "\"name\": \"$name\"" "$INTEG_FILE" | sed -n 's/.*"notes"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
      [ -n "$notes" ] && TOUCHED="${TOUCHED}  - _${notes}_\n"
    fi
  done < <(grep '"name"' "$INTEG_FILE")
  if [ -n "$TOUCHED" ]; then
    printf '%b\n' "$TOUCHED" >>"$BUF"
  else
    write "(no listed integration code paths touched)"
  fi
  write ""
fi

# ───────────────────────── 6. Deploy plan ─────────────────────────
write "## Deploy plan"
write "- Push to \`origin/$(git branch --show-current)\` → Vercel auto-deploys."
[ -n "$CHANGED_SQL" ] && write "- **Manual: run new migrations on Supabase before merging to main.**"
ENV_NEW=$(echo "${UNKNOWN:-}" | grep . | head -3 || true)
[ -n "$ENV_NEW" ] && write "- **Manual: verify these env vars exist on Vercel:** $(echo "$ENV_NEW" | tr '\n' ' ')"
write "- After push, monitor: \`gh api repos/mikr-praxis/Praxis-CENTCOM/commits/HEAD/status\`"
write ""

# ───────────────────────── 7. Reminder for semantic review ─────────────────────────
write "## Next: semantic review"
write "Invoke the \`qc-deploy\` subagent for a deeper review (TS strict patterns, Supabase typed-insert traps, defensive migration column handling). Then commit."
write ""

# ───────────────────────── Verdict ─────────────────────────
if [ "$FAIL" -ne 0 ]; then
  write "## ❌ QC FAILED — fix the issues above before committing."
elif [ "$WARN" -ne 0 ]; then
  write "## ⚠️ QC PASSED WITH WARNINGS — review before committing."
else
  write "## ✅ QC PASSED"
fi

# Persist + emit
cp "$BUF" "$REPORT"
cat "$BUF" >&2
[ "$FAIL" -ne 0 ] && exit 2
exit 0
