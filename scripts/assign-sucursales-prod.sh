#!/usr/bin/env bash
#
# Wrapper around `scripts/assign-sucursales.ts` that runs it against the
# PRODUCTION Neon + nubebar databases instead of whatever is in `.env.local`
# (issue #12 / ADR 0002). Safe for a human or an agent to run: it never
# mutates `.env.local`, pulls a fresh production env file on demand, prints
# which database host it's about to write to, and requires an explicit
# confirmation unless `--yes` is passed (for non-interactive/agent use).
#
# Usage:
#   ./scripts/assign-sucursales-prod.sh --email me@example.com --sucursales 1,2
#   ./scripts/assign-sucursales-prod.sh --yes --email me@example.com --sucursales 1,2
#
# All other flags are passed straight through to assign-sucursales.ts.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env.production.local"
SKIP_CONFIRM=false
ARGS=()

for arg in "$@"; do
  if [[ "$arg" == "--yes" ]]; then
    SKIP_CONFIRM=true
  else
    ARGS+=("$arg")
  fi
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No $ENV_FILE found — pulling production env vars from Vercel..." >&2
  vercel env pull "$ENV_FILE" --environment=production
fi

# Best-effort host extraction for the confirmation prompt — never fails the
# script if the URL shape is unexpected.
DB_HOST=$(grep -E '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null \
  | sed -E 's#.*://[^@]*@([^/?]*).*#\1#' || true)

echo "About to run against PRODUCTION:" >&2
echo "  app DB host:     ${DB_HOST:-<could not parse $ENV_FILE>}" >&2
echo "  assign-sucursales args: ${ARGS[*]}" >&2

if [[ "$SKIP_CONFIRM" != true ]]; then
  read -r -p "Type 'yes' to continue: " confirm
  if [[ "$confirm" != "yes" ]]; then
    echo "Aborted — no changes made." >&2
    exit 1
  fi
fi

# `set -a` + `source` exports every assignment in the env file for the
# duration of this script, the same way `.env` files are conventionally
# loaded in shell — safer than re-splitting the file with `xargs`, since it
# respects quoting for values containing `@`, `?`, `&`, etc. (connection
# strings always do).
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

npx tsx scripts/assign-sucursales.ts "${ARGS[@]}"
