#!/usr/bin/env bash
# SessionStart hook: validates and exports runtime paths for a Claude Code cloud session.
# POST-SETUP ONLY. It never installs, repairs, downloads, clones, or starts a product or Docker.
# Outside a Claude Code cloud session (CLAUDE_CODE_REMOTE is not "true") it skips honestly.
# Selection contract (shared with scripts/cloud-install.sh): the Node 24 runtime is
#   $QA_TOOLCHAIN_ROOT/node/24.22.0/bin/node   (default root: $HOME/.cache/qa-portfolio/toolchains)
# and is valid only with a manifest. A stale /opt/node24 is never consulted.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  printf 'session-start: skipped (not a Claude Code cloud session: CLAUDE_CODE_REMOTE is not "true")\n' >&2
  exit 0
fi

NODE22_MIN="22.22.0"
NODE22_PROVISION_VERSION="22.23.3"
NODE24_VERSION="24.22.0"
MANIFEST_NAME=".qa-toolchain-manifest"
DEFAULT_PRODUCTS_ROOT="/home/user/products"
DEFAULT_TOOLCHAIN_SUBDIR=".cache/qa-portfolio/toolchains"

fail() { printf 'session-start: ERROR %s\n' "$*" >&2; exit 1; }
note() { printf 'session-start: %s\n' "$*" >&2; }

# Returns 0 when version $1 >= $2 (dotted numeric).
version_ge() { [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n 1)" = "$2" ]; }
node_version_of() { "$1" -p 'process.versions.node' 2>/dev/null; }

# A provisioned runtime is valid only with its manifest and an exact reported version.
valid_install() {
  local dir="$1" ver="$2" bin m got
  bin="$dir/bin/node"; m="$dir/$MANIFEST_NAME"
  [ -f "$m" ] && [ ! -L "$m" ] && [ -x "$bin" ] || return 1
  grep -qx "version=$ver" "$m" || return 1
  grep -qE '^archive_sha256=[0-9a-f]{64}$' "$m" || return 1
  got="$(node_version_of "$bin" || true)"
  [ "$got" = "$ver" ]
}

# ---- 1. Validate everything first. Nothing is written until every check has passed. ----
ROOT="${QA_TOOLCHAIN_ROOT:-}"
if [ -z "$ROOT" ]; then
  [ -n "${HOME:-}" ] || fail "HOME is unset and QA_TOOLCHAIN_ROOT is not set; no toolchain root."
  ROOT="$HOME/$DEFAULT_TOOLCHAIN_SUBDIR"
fi
case "$ROOT" in /*) ;; *) fail "toolchain root must be an absolute path." ;; esac
case "$ROOT" in *$'\n'*) fail "toolchain root contains a newline." ;; esac

# Node 22 (repository runtime): a compatible runtime already first on PATH, else the provisioned one.
NODE22=""
path_node="$(command -v node 2>/dev/null || true)"
if [ -n "$path_node" ] && [ -x "$path_node" ]; then
  real="$(readlink -f "$path_node")"
  v="$(node_version_of "$real" || true)"
  if [[ "$v" == 22.* ]] && version_ge "$v" "$NODE22_MIN"; then NODE22="$real"; fi
fi
if [ -z "$NODE22" ]; then
  d22="$ROOT/node/$NODE22_PROVISION_VERSION"
  if valid_install "$d22" "$NODE22_PROVISION_VERSION"; then
    NODE22="$d22/bin/node"
  else
    fail "no Node 22 >= $NODE22_MIN on PATH and no valid Node $NODE22_PROVISION_VERSION under $ROOT. Setup provisions it; this hook does not install."
  fi
fi

# Node 24 (Documenso only): the exact approved version from the selection contract.
NODE24_DIR="$ROOT/node/$NODE24_VERSION"
valid_install "$NODE24_DIR" "$NODE24_VERSION" \
  || fail "selected Node $NODE24_VERSION is not valid at $NODE24_DIR (missing bin, manifest, or version mismatch). Setup must provision it; no other Node 24 is selected."
NODE24="$NODE24_DIR/bin/node"

# Products root: an absolute path, never inside node_modules. Existence is not required here:
# product-free sessions have no product workspace yet.
PRODUCTS="${PRODUCTS_ROOT:-$DEFAULT_PRODUCTS_ROOT}"
case "$PRODUCTS" in /*) ;; *) fail "PRODUCTS_ROOT must be an absolute path." ;; esac
case "$PRODUCTS" in *$'\n'*) fail "PRODUCTS_ROOT contains a newline." ;; esac
case "$PRODUCTS" in */node_modules | */node_modules/*) fail "PRODUCTS_ROOT must not be inside node_modules." ;; esac

[ -n "${CLAUDE_ENV_FILE:-}" ] || fail "CLAUDE_ENV_FILE is not set; the SessionStart interface cannot export runtime paths."

# ---- 2. All validations passed: write one block of shell-quoted exports. ----
NEW_PATH="$(dirname "$NODE22"):${PATH:-/usr/bin:/bin}"
EXPORTS="$(printf 'export PATH=%q\nexport NODE22=%q\nexport NODE24=%q\nexport QA_TOOLCHAIN_ROOT=%q\nexport PRODUCTS_ROOT=%q\n' \
  "$NEW_PATH" "$NODE22" "$NODE24" "$ROOT" "$PRODUCTS")"
printf '%s\n' "$EXPORTS" >> "$CLAUDE_ENV_FILE" || fail "cannot write CLAUDE_ENV_FILE."
note "exported NODE22, NODE24, QA_TOOLCHAIN_ROOT and PRODUCTS_ROOT (absolute) and a Node 22-first PATH"
