#!/usr/bin/env bash
# Report-only policy (O-6, plan 5.0): report jobs run on push to main, on workflow_dispatch, and on a pull
# request whose diff touches config/scan/. Prints report=true|false. Exit 2 on input it cannot judge (fail closed).
set -euo pipefail

event="${EVENT_NAME:-}"
case "$event" in
  workflow_dispatch)
    echo "report=true"
    ;;
  push)
    if [[ "${GIT_REF:-}" == "refs/heads/main" ]]; then echo "report=true"; else echo "report=false"; fi
    ;;
  pull_request)
    base="${BASE_SHA:-}"
    head="${HEAD_SHA:-HEAD}"
    if [[ ! "$base" =~ ^[0-9a-f]{40}$ ]]; then
      echo "decide-report: BASE_SHA is missing or malformed" >&2
      exit 2
    fi
    changed="$(git diff --name-only "$base...$head")"
    if grep -q '^config/scan/' <<< "$changed"; then echo "report=true"; else echo "report=false"; fi
    ;;
  *)
    echo "decide-report: unsupported EVENT_NAME '$event'" >&2
    exit 2
    ;;
esac
