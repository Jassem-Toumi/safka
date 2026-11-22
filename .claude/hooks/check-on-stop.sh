#!/usr/bin/env bash
#
# Stop hook: a turn cannot end while typecheck or the tests fail.
#
# Adapted from cszach/new-project-template for a hackathon: one fast gate
# (the repo's typecheck and Vitest suite, seconds), run only when src/ or
# tests/ has uncommitted changes, so docs and question-answering turns are
# not slowed. It matches the backend's own handoff rule in CLAUDE.md.
#
# Exit 0 -> turn ends normally.
# Exit 2 -> stderr goes back to Claude as the reason to keep working.

set -uo pipefail

# Node 24 provides node:sqlite, which the backend and its tests need.
CHECK="source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null && npm run typecheck && npm test"
WATCHED=(src tests)

input=$(cat)

# Set when this turn is already a retry triggered by this hook; honouring it
# stops a failing check from looping forever.
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
	exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -d "$project_dir" ] || exit 0
cd "$project_dir" || exit 0

if [ -z "$(git status --porcelain -- "${WATCHED[@]}" 2>/dev/null)" ]; then
	exit 0
fi

# No install yet means nothing can be checked; say so rather than fail.
if [ ! -d node_modules ]; then
	echo "node_modules is missing; run npm ci (Node 24, see .nvmrc)." >&2
	exit 0
fi

if output=$(bash -c "$CHECK" 2>&1); then
	exit 0
fi

cat >&2 <<MSG
\`$CHECK\` is failing, so this work is not done. Fix the errors below, then
run it yourself to confirm it passes. Do not report the task as complete
while it fails, and do not weaken a test, a lint rule or a type to pass.

$(printf '%s' "$output" | tail -n 60)
MSG

exit 2
