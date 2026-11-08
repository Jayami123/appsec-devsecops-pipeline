#!/usr/bin/env bash
# SessionStart hook: POST-SETUP ONLY. It never installs, repairs or starts anything, and it never
# starts a product. It exports absolute runtime paths for this session through CLAUDE_ENV_FILE.
# Setup (scripts/cloud-install.sh) must already have provisioned Node 22 and Node 24.
set -euo pipefail

NODE22_MIN="22.22.0"
NODE22_SETUP_PREFIX="/opt/node22"
NODE24="/opt/node24/bin/node"
NODE24_VERSION="24.22.0"
DEFAULT_PRODUCTS_ROOT="/home/user/products"

fail() { printf 'session-start: ERROR %s\n' "$*" >&2; exit 1; }
note() { printf 'session-start: %s\n' "$*" >&2; }

# Returns 0 when version $1 >= $2 (dotted numeric).
version_ge() { [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n 1)" = "$2" ]; }
node_version_of() { "$1" -p 'process.versions.node' 2>/dev/null; }

if [ -z "${CLAUDE_ENV_FILE:-}" ]; then
  fail "CLAUDE_ENV_FILE is not set; the SessionStart interface cannot export runtime paths (setup prerequisite missing)."
fi
: >> "$CLAUDE_ENV_FILE" 2>/dev/null || fail "CLAUDE_ENV_FILE is not writable: $CLAUDE_ENV_FILE"

# Node 22 (repository runtime): first compatible candidate on PATH, then the setup-provisioned path.
NODE22=""
for cand in "$(command -v node 2>/dev/null || true)" "$NODE22_SETUP_PREFIX/bin/node"; do
  [ -n "$cand" ] && [ -x "$cand" ] || continue
  real="$(readlink -f "$cand")"
  v="$(node_version_of "$real" || true)"
  if [[ "$v" == 22.* ]] && version_ge "$v" "$NODE22_MIN"; then
    NODE22="$real"
    break
  fi
done
[ -n "$NODE22" ] || fail "no Node 22 >= $NODE22_MIN on PATH or at $NODE22_SETUP_PREFIX/bin/node. Run setup (scripts/cloud-install.sh); this hook does not install."

# Node 24 (Documenso only): exact approved version at the absolute setup path.
[ -x "$NODE24" ] || fail "Node 24 is not executable at $NODE24 (setup prerequisite missing)."
v24="$(node_version_of "$NODE24" || true)"
[ "$v24" = "$NODE24_VERSION" ] || fail "$NODE24 reports '${v24:-unavailable}', expected $NODE24_VERSION."

# Products root: an explicit absolute path that setup has created.
PRODUCTS_ROOT_VALUE="${PRODUCTS_ROOT:-$DEFAULT_PRODUCTS_ROOT}"
case "$PRODUCTS_ROOT_VALUE" in
  /*) ;;
  *) fail "PRODUCTS_ROOT must be absolute (got a relative value)." ;;
esac
[ -d "$PRODUCTS_ROOT_VALUE" ] || fail "PRODUCTS_ROOT directory is missing: $PRODUCTS_ROOT_VALUE (setup prerequisite)."

NODE22_PATH_VALUE="$(dirname "$NODE22"):${PATH}"
{
  printf 'export PATH=%q\n' "$NODE22_PATH_VALUE"
  printf 'export NODE22=%q\n' "$NODE22"
  printf 'export NODE24=%q\n' "$NODE24"
  printf 'export PRODUCTS_ROOT=%q\n' "$PRODUCTS_ROOT_VALUE"
} >> "$CLAUDE_ENV_FILE"
note "exported NODE22, NODE24 and PRODUCTS_ROOT (absolute) and a Node 22-first PATH"

# Docker is a later product-lane prerequisite, not an F0-1 one: report it, do not start anything.
if timeout 20 docker info >/dev/null 2>&1; then
  note "docker: daemon reachable"
else
  note "docker: UNAVAILABLE (docker info failed). Required before any product lane; this hook starts nothing."
fi
