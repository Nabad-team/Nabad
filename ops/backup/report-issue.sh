#!/usr/bin/env bash
# Opens, updates or closes the public "backup-failure" issue for a backup workflow.
#   report-issue.sh fail "<issue title>"   open the issue, or comment on the open one
#   report-issue.sh ok   "<issue title>"   close the open issue with that title, if any
# Needs GH_TOKEN, GITHUB_REPOSITORY, RUN_URL; for "fail" also STEPS_JSON (toJSON(steps)).
# The issue only ever holds the run link, the failed step and a timestamp: never any data.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:?usage: report-issue.sh fail|ok <title>}"
title="${2:?usage: report-issue.sh fail|ok <title>}"
label="backup-failure"
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

open_issue="$(gh issue list --repo "$GITHUB_REPOSITORY" --label "$label" --state open --limit 50 \
  --json number,title --jq "map(select(.title == \"$title\")) | first | .number // empty")"

case "$mode" in
  fail)
    step="$(node "$here/cli.js" failed-step)"
    # shellcheck disable=SC2016 # the backticks are Markdown, not a command substitution
    body="$(printf 'The backup workflow failed at step `%s` (%s).\n\nRun: %s\n\nSee docs/backups.md, "When a backup-failure issue opens". This issue closes itself after the next successful run.' "$step" "$now" "$RUN_URL")"
    if [ -n "$open_issue" ]; then
      gh issue comment "$open_issue" --repo "$GITHUB_REPOSITORY" --body "$body" >/dev/null
      echo "Commented on issue #$open_issue."
    else
      gh label create "$label" --repo "$GITHUB_REPOSITORY" --color B60205 \
        --description "A database backup workflow failed" >/dev/null 2>&1 || true
      gh issue create --repo "$GITHUB_REPOSITORY" --title "$title" --label "$label" --body "$body"
    fi
    ;;
  ok)
    if [ -n "$open_issue" ]; then
      gh issue close "$open_issue" --repo "$GITHUB_REPOSITORY" \
        --comment "Fixed: the next run succeeded ($now). Run: $RUN_URL" >/dev/null
      echo "Closed issue #$open_issue."
    fi
    ;;
  *)
    echo "usage: report-issue.sh fail|ok <title>" >&2
    exit 2
    ;;
esac
