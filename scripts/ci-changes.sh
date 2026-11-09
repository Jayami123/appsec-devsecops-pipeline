#!/usr/bin/env bash
# Change classifier for .github/workflows/ci.yml (plan section 9.5).
# Input: changed paths on stdin, one per line. Env: EVENT_NAME (pull_request | push | workflow_dispatch),
# BEFORE_SHA (push only; all zeros means a new branch and runs every lane).
# Output: one `name=true|false` line per flag, in the order the caller reads them. Nothing else is printed,
# because the caller appends this output to $GITHUB_OUTPUT.
set -euo pipefail

event="${EVENT_NAME:-}"
before="${BEFORE_SHA:-}"

case "$event" in
  pull_request | push | workflow_dispatch) ;;
  *)
    echo "ci-changes: unsupported EVENT_NAME '$event'" >&2
    exit 2
    ;;
esac

re_cal='^(src/lanes/cal/|tests/unit/lanes/cal/|tests/(contracts|webhooks|integration|serial|ui)/cal/|\.github/workflows/p5-cal\.yml$)'
re_doc='^(src/lanes/doc/|tests/unit/lanes/doc/|tests/(contracts|webhooks|integration|serial|ui)/doc/|\.github/workflows/p5-doc\.yml$)'
re_med='^(src/lanes/med/|tests/unit/lanes/med/|tests/(contracts|webhooks|integration|serial|ui)/med/|\.github/workflows/p5-med\.yml$)'
re_tw='^(src/lanes/tw/|tests/unit/lanes/tw/|tests/(contracts|webhooks|integration|serial|ui)/tw/|\.github/workflows/p5-tw\.yml$)'
re_tw_iso='^(src/lanes/tw-iso/|tests/iso/|tests/limiter-last/|\.github/workflows/p5-tw-iso\.yml$)'
re_x='^(src/lanes/cal/csv-corpus\.ts$|src/lanes/x/|tests/closeout/medusa/|tests/closeout/twenty/|\.github/workflows/p5-x\.yml$)'
# Shared paths run every lane. scripts/ is shared except scripts/scan/, which is matched by re_scanner first.
re_shared='^(src/kit/|src/security/|package\.json$|package-lock\.json$|tsconfig\.json$|playwright\.config\.ts$|eslint\.config\.mjs$|\.github/workflows/ci\.yml$|\.github/workflows/foundation\.yml$|scripts/)'
# Scanner-owned paths (L-PIPE): CodeQL and scanners only, no product lane.
re_scanner='^(scripts/scan/|config/scan/|\.github/workflows/(p5-scans|codeql-reusable|p5-zap-nightly)\.yml$)'
# Documentation-only paths that no lane or CodeQL depends on.
re_neutral='^(docs/|README\.md$|AGENTS\.md$|CLAUDE\.md$)'

cal=false doc=false med=false tw=false tw_iso=false x=false codeql=false
full=false
any_path=false

while IFS= read -r path || [[ -n "$path" ]]; do
  [[ -z "$path" ]] && continue
  any_path=true
  if [[ "$path" =~ $re_neutral ]]; then
    continue
  fi
  codeql=true
  if [[ "$path" =~ $re_scanner ]]; then
    :
  elif [[ "$path" =~ $re_shared ]]; then
    full=true
  else
    matched=false
    if [[ "$path" =~ $re_cal ]]; then cal=true; matched=true; fi
    if [[ "$path" =~ $re_doc ]]; then doc=true; matched=true; fi
    if [[ "$path" =~ $re_med ]]; then med=true; matched=true; fi
    if [[ "$path" =~ $re_tw ]]; then tw=true; matched=true; fi
    if [[ "$path" =~ $re_tw_iso ]]; then tw_iso=true; matched=true; fi
    if [[ "$path" =~ $re_x ]]; then x=true; matched=true; fi
    # Unknown path: fail safe, every lane and CodeQL.
    if [[ "$matched" == false ]]; then full=true; fi
  fi
done

if [[ "$event" == "workflow_dispatch" ]]; then
  full=true
fi
if [[ "$event" == "push" && "$before" =~ ^0+$ ]]; then
  full=true
fi
if [[ "$event" == "pull_request" && "$any_path" == false ]]; then
  full=true
fi

if [[ "$full" == true ]]; then
  cal=true doc=true med=true tw=true tw_iso=true x=true codeql=true
fi

# p5_scans runs for every pull_request, push and workflow_dispatch regardless of paths (plan 9.5).
printf 'p5_cal=%s\n' "$cal"
printf 'p5_doc=%s\n' "$doc"
printf 'p5_med=%s\n' "$med"
printf 'p5_tw=%s\n' "$tw"
printf 'p5_tw_iso=%s\n' "$tw_iso"
printf 'p5_x=%s\n' "$x"
printf 'p5_codeql=%s\n' "$codeql"
printf 'p5_scans=%s\n' "true"
