#!/usr/bin/env bash
# Install entry point for cloud environments (Claude Code setup script, Cursor `install`).
#
#   bash scripts/cloud-install.sh                   full: toolchains, npm ci, product bootstrap
#   bash scripts/cloud-install.sh --toolchain-only  diagnostic: toolchains only, then exit 0
#
# Runtime selection contract (shared with bootstrap.sh, the SessionStart hook and the Cursor Dockerfile):
#   root    = $QA_TOOLCHAIN_ROOT (explicit absolute base) or $HOME/.cache/qa-portfolio/toolchains
#   Node 24 = $root/node/24.22.0/bin/node   (exact pin; reproducibility, not a product requirement)
#   Node 22 = the compatible runtime first on PATH (>= 22.22.0, family 22), else $root/node/22.23.3
# Each installation is side by side: it is staged privately, verified (archive SHA-256 against the
# published SHASUMS256 entry, then the reported version), and only then promoted with an atomic rename.
# A valid installation is reused; any conflicting content is an error and is never modified.
# /opt/node24 and other system installations are never selected or overwritten.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

NODE22_MIN="22.22.0"
NODE22_PROVISION_VERSION="22.23.3"
NODE24_VERSION="24.22.0"
NPM24_MIN="11.17.0"
DEFAULT_TOOLCHAIN_SUBDIR=".cache/qa-portfolio/toolchains"
MANIFEST_NAME=".qa-toolchain-manifest"
DIST_BASE="https://nodejs.org/dist"
# PROVISIONAL OPERATIONAL BOUND, not a measured SLA: per-request curl --max-time for a Node archive
# or SHASUMS256.txt. Calibrate after the first measured setup run; never raise it to get green.
NODE_DOWNLOAD_MAX_TIME_S=600

STAGE_DIR=""
cleanup() { if [ -n "$STAGE_DIR" ] && [ -d "$STAGE_DIR" ]; then rm -rf "$STAGE_DIR"; fi; }
trap cleanup EXIT

log() { printf '[cloud-install] %s\n' "$*"; }
die() { printf '[cloud-install] ERROR %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Usage: bash scripts/cloud-install.sh [--toolchain-only]
  (no argument)     full setup: toolchains, npm ci, bootstrap of medusa, twenty, documenso, cal
  --toolchain-only  provision/verify Node 22 and Node 24, then exit 0 before npm ci and bootstrap
Environment:
  QA_TOOLCHAIN_ROOT  explicit absolute toolchain base (default: $HOME/.cache/qa-portfolio/toolchains)
  PRODUCTS_ROOT      full mode only; absolute; default $HOME/products
USAGE
}

as_root() { if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi; }

# Returns 0 when version $1 >= $2 (dotted numeric).
version_ge() { [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n 1)" = "$2" ]; }

node_version_of() { "$1" -p 'process.versions.node' 2>/dev/null; }

check_tools() {
  local t
  for t in curl tar xz sha256sum awk readlink sort mktemp date uname grep mv; do
    command -v "$t" >/dev/null 2>&1 || die "required tool '$t' is not available (ENV)"
  done
}

set_toolchain_root() {
  TOOLCHAIN_ROOT="${QA_TOOLCHAIN_ROOT:-}"
  if [ -z "$TOOLCHAIN_ROOT" ]; then
    [ -n "${HOME:-}" ] || die "HOME is unset and QA_TOOLCHAIN_ROOT is not set (ENV)"
    TOOLCHAIN_ROOT="$HOME/$DEFAULT_TOOLCHAIN_SUBDIR"
  fi
  case "$TOOLCHAIN_ROOT" in
    /*) ;;
    *) die "QA_TOOLCHAIN_ROOT must be an absolute path" ;;
  esac
  case "$TOOLCHAIN_ROOT" in
    *$'\n'*) die "toolchain root contains a newline" ;;
  esac
}

# Selection contract (identical in .claude/hooks/session-start.sh): an explicit PRODUCTS_ROOT
# wins; otherwise $HOME/products; HOME unset with no PRODUCTS_ROOT is an error.
set_products_root_default() {
  PRODUCTS_ROOT="${PRODUCTS_ROOT:-}"
  if [ -z "$PRODUCTS_ROOT" ]; then
    [ -n "${HOME:-}" ] || die "HOME is unset and PRODUCTS_ROOT is not set (ENV)"
    PRODUCTS_ROOT="$HOME/products"
  fi
}

set_products_root() {
  set_products_root_default
  case "$PRODUCTS_ROOT" in
    /*) ;;
    *) die "PRODUCTS_ROOT must be an absolute path (got a relative value)" ;;
  esac
  case "$PRODUCTS_ROOT" in
    */node_modules | */node_modules/*) die "PRODUCTS_ROOT must not be inside node_modules" ;;
  esac
  mkdir -p "$PRODUCTS_ROOT" || die "cannot create PRODUCTS_ROOT=$PRODUCTS_ROOT"
  [ -w "$PRODUCTS_ROOT" ] || die "PRODUCTS_ROOT=$PRODUCTS_ROOT is not writable"
}

set_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) NODE_ARCH="x64" ;;
    aarch64 | arm64) NODE_ARCH="arm64" ;;
    *) die "unsupported architecture $(uname -m) for the official Node download (ENV)" ;;
  esac
}

# Returns 0 only when $1 is a complete, valid installation of exactly version $2 for archive $3.
manifest_ok() {
  local dir="$1" ver="$2" file="$3" m="$1/$MANIFEST_NAME" got
  [ -d "$dir" ] && [ ! -L "$dir" ] || return 1
  [ -f "$m" ] && [ ! -L "$m" ] && [ -x "$dir/bin/node" ] || return 1
  grep -qx "version=$ver" "$m" || return 1
  grep -qx "archive=$file" "$m" || return 1
  grep -qE '^archive_sha256=[0-9a-f]{64}$' "$m" || return 1
  got="$(node_version_of "$dir/bin/node" || true)"
  [ "$got" = "$ver" ]
}

# Sets PROVISIONED_DIR to a valid installation of Node $1, reusing an existing valid one.
provision_node() {
  local ver="$1" target file base expected actual got start
  target="$TOOLCHAIN_ROOT/node/$ver"
  file="node-v${ver}-linux-${NODE_ARCH}.tar.xz"
  if [ -L "$target" ]; then die "$target is a symlink; refusing to use it (conflict)"; fi
  if [ -e "$target" ]; then
    if manifest_ok "$target" "$ver" "$file"; then
      log "reusing valid Node $ver at $target (manifest and reported version match)"
      PROVISIONED_DIR="$target"
      return 0
    fi
    die "$target exists but is not a valid Node $ver installation (missing manifest or version mismatch). Not modified; resolve the conflict (ENV)."
  fi
  mkdir -p "$TOOLCHAIN_ROOT/node"
  STAGE_DIR="$(mktemp -d "$TOOLCHAIN_ROOT/node/.stage-$ver.XXXXXX")"
  base="$DIST_BASE/v$ver"
  start="$(date +%s)"
  curl -fsSL --retry 3 --max-time "$NODE_DOWNLOAD_MAX_TIME_S" -o "$STAGE_DIR/SHASUMS256.txt" "$base/SHASUMS256.txt" \
    || die "could not fetch $base/SHASUMS256.txt (blocked host or network failure; no workaround) (ENV)"
  curl -fsSL --retry 3 --max-time "$NODE_DOWNLOAD_MAX_TIME_S" -o "$STAGE_DIR/$file" "$base/$file" \
    || die "could not fetch $base/$file (blocked host or network failure) (ENV)"
  expected="$(awk -v f="$file" '$2 == f { print $1 }' "$STAGE_DIR/SHASUMS256.txt")"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || die "no single published SHA-256 entry for $file (ENV)"
  actual="$(sha256sum "$STAGE_DIR/$file" | awk '{ print $1 }')"
  [ "$actual" = "$expected" ] || die "SHA-256 mismatch for $file; archive not extracted"
  mkdir "$STAGE_DIR/extract"
  tar -xJf "$STAGE_DIR/$file" -C "$STAGE_DIR/extract" --strip-components=1
  got="$(node_version_of "$STAGE_DIR/extract/bin/node" || true)"
  [ "$got" = "$ver" ] || die "staged runtime reports '${got:-unavailable}', expected $ver"
  printf 'version=%s\narchive=%s\narchive_sha256=%s\nsource=%s/\n' "$ver" "$file" "$expected" "$base" \
    > "$STAGE_DIR/extract/$MANIFEST_NAME"
  if [ -e "$target" ] || [ -L "$target" ]; then die "$target appeared during provisioning; not overwritten (ENV)"; fi
  mv -T "$STAGE_DIR/extract" "$target"
  manifest_ok "$target" "$ver" "$file" || die "promoted installation failed validation at $target"
  log "installed Node $ver at $target: archive $file verified (sha256 matches published SHASUMS256), $(( $(date +%s) - start )) s; provisional download bound ${NODE_DOWNLOAD_MAX_TIME_S} s per request"
  PROVISIONED_DIR="$target"
}

# Sets NODE22 to the compatible runtime already first on PATH, if any.
path_node22() {
  local cand real v
  cand="$(command -v node 2>/dev/null || true)"
  [ -n "$cand" ] && [ -x "$cand" ] || return 1
  real="$(readlink -f "$cand")"
  v="$(node_version_of "$real" || true)"
  if [[ "$v" == 22.* ]] && version_ge "$v" "$NODE22_MIN"; then
    NODE22="$real"
    return 0
  fi
  return 1
}

main() {
  local mode="full" start_total end_total NODE22="" NODE24="" npm22 npm24 node22_v node24_v
  if [ "$#" -gt 1 ]; then usage >&2; die "too many arguments"; fi
  case "${1:-}" in
    "") ;;
    --toolchain-only) mode="toolchain" ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument: $1" ;;
  esac

  start_total="$(date +%s)"
  check_tools
  set_toolchain_root
  set_arch
  log "toolchain root: $TOOLCHAIN_ROOT"

  if path_node22; then
    log "Node 22 on PATH: $NODE22"
  else
    provision_node "$NODE22_PROVISION_VERSION"
    NODE22="$PROVISIONED_DIR/bin/node"
  fi
  node22_v="$(node_version_of "$NODE22")"
  version_ge "$node22_v" "$NODE22_MIN" || die "Node 22 reports $node22_v, below $NODE22_MIN (ENV)"

  provision_node "$NODE24_VERSION"
  NODE24="$PROVISIONED_DIR/bin/node"
  node24_v="$(node_version_of "$NODE24")"
  [ "$node24_v" = "$NODE24_VERSION" ] || die "selected NODE24 reports $node24_v, expected $NODE24_VERSION"

  if [ -e /opt/node24 ]; then
    log "note: /opt/node24 exists and is NOT selected by this contract (reports $(node_version_of /opt/node24/bin/node || echo unavailable)); left untouched"
  fi

  # Each runtime's own bundled npm, with its own bin directory first on PATH.
  npm22="$(PATH="$(dirname "$NODE22"):$PATH" "$(dirname "$NODE22")/npm" --version)"
  npm24="$(PATH="$(dirname "$NODE24"):$PATH" "$(dirname "$NODE24")/npm" --version)"
  version_ge "$npm24" "$NPM24_MIN" || die "Node 24 npm $npm24 is below $NPM24_MIN required by the Documenso fork (ENV)"

  # Repository runtime first on PATH; a child script cannot export back to the caller's shell.
  export NODE22 NODE24 QA_TOOLCHAIN_ROOT="$TOOLCHAIN_ROOT"
  export PATH="$(dirname "$NODE22"):$PATH"

  end_total="$(date +%s)"
  log "NODE22=$NODE22 (v$node22_v, npm $npm22)"
  log "NODE24=$NODE24 (v$node24_v, npm $npm24 >= $NPM24_MIN)"
  log "toolchain provisioning and checks: $((end_total - start_total)) s"

  if [ "$mode" = "toolchain" ]; then
    log "--toolchain-only: stopping before npm ci and product bootstrap (no product was cloned or started)"
    exit 0
  fi

  set_products_root
  log "PRODUCTS_ROOT=$PRODUCTS_ROOT"

  [ -f package-lock.json ] || die "package-lock.json is missing; cannot run npm ci"
  log "npm ci (Node $node22_v)"
  npm ci

  # All four products are named explicitly: bootstrap's own no-argument default is medusa only.
  NODE24="$NODE24" PRODUCTS_ROOT="$PRODUCTS_ROOT" bash scripts/bootstrap.sh medusa twenty documenso cal
  log "full setup finished"
}

main "$@"
