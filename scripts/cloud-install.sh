#!/usr/bin/env bash
# Install entry point for cloud environments (Claude Code setup script, Cursor `install`).
#
#   bash scripts/cloud-install.sh                  full: toolchains, npm ci, product bootstrap
#   bash scripts/cloud-install.sh --toolchain-only diagnostic: toolchains only, then exit 0
#
# Order: toolchains are provisioned and verified BEFORE npm ci or any product bootstrap.
# --toolchain-only is the F0-1 product-free check. It never runs npm ci, never clones a product
# and never starts a product. It is not a placeholder: any provisioning failure exits non-zero.
# Full mode is not run during F0-1 verification.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

NODE22_MIN="22.22.0"
# Setup-time provisioning target if no compatible Node 22 exists on the host (Cursor Dockerfile pin).
NODE22_SETUP_VERSION="22.23.3"
NODE22_PREFIX="/opt/node22"
NODE24_VERSION="24.22.0"
NODE24_PREFIX="/opt/node24"
NPM24_MIN="11.17.0"
DEFAULT_PRODUCTS_ROOT="/home/user/products"
DIST_BASE="https://nodejs.org/dist"
# PROVISIONAL OPERATIONAL BOUND, not a measured SLA: per-request curl --max-time for a Node
# archive or SHASUMS256.txt. Calibrate after the first measured setup run; never raise to get green.
NODE_DOWNLOAD_MAX_TIME_S=600

TMP_DIR=""
cleanup() { if [ -n "$TMP_DIR" ]; then rm -rf "$TMP_DIR"; fi; }
trap cleanup EXIT

log() { printf '[cloud-install] %s\n' "$*"; }
die() { printf '[cloud-install] ERROR %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Usage: bash scripts/cloud-install.sh [--toolchain-only]
  (no argument)     full setup: toolchains, npm ci, bootstrap of medusa, twenty, documenso, cal
  --toolchain-only  provision/verify Node 22 and Node 24, then exit 0 before npm ci and bootstrap
Environment: PRODUCTS_ROOT (full mode only; default /home/user/products; must be absolute).
USAGE
}

as_root() { if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi; }

# Returns 0 when version $1 >= $2 (dotted numeric).
version_ge() { [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n 1)" = "$2" ]; }

node_version_of() { "$1" -p 'process.versions.node' 2>/dev/null; }

check_tools() {
  local t
  for t in curl tar xz sha256sum awk readlink sort mktemp date uname; do
    command -v "$t" >/dev/null 2>&1 || die "required tool '$t' is not available (ENV)"
  done
}

# Sets NODE22 to an absolute resolved path when a compatible Node 22 is already present.
resolve_node22() {
  local cand real v
  for cand in "$(command -v node 2>/dev/null || true)" "$NODE22_PREFIX/bin/node"; do
    [ -n "$cand" ] && [ -x "$cand" ] || continue
    real="$(readlink -f "$cand")"
    v="$(node_version_of "$real" || true)"
    if [[ "$v" == 22.* ]] && version_ge "$v" "$NODE22_MIN"; then
      NODE22="$real"
      return 0
    fi
  done
  return 1
}

# Downloads an official Node archive and its SHASUMS256.txt, verifies the archive, then extracts.
# Refuses to touch an existing prefix: an unexpected installation is reported, never overwritten.
install_node_verified() {
  local ver="$1" prefix="$2"
  local arch file base expected actual got start end
  if [ -e "$prefix" ]; then
    die "$prefix already exists and is not Node $ver; not overwritten. Report this conflict (ENV)."
  fi
  case "$(uname -m)" in
    x86_64 | amd64) arch="x64" ;;
    aarch64 | arm64) arch="arm64" ;;
    *) die "unsupported architecture $(uname -m) for the official Node $ver download (ENV)" ;;
  esac
  file="node-v${ver}-linux-${arch}.tar.xz"
  base="$DIST_BASE/v${ver}"
  TMP_DIR="$(mktemp -d)"
  start="$(date +%s)"
  curl -fsSL --retry 3 --max-time "$NODE_DOWNLOAD_MAX_TIME_S" -o "$TMP_DIR/SHASUMS256.txt" \
    "$base/SHASUMS256.txt" || die "could not fetch $base/SHASUMS256.txt (blocked host or network failure; no workaround) (ENV)"
  curl -fsSL --retry 3 --max-time "$NODE_DOWNLOAD_MAX_TIME_S" -o "$TMP_DIR/$file" \
    "$base/$file" || die "could not fetch $base/$file (blocked host or network failure) (ENV)"
  expected="$(awk -v f="$file" '$2 == f { print $1 }' "$TMP_DIR/SHASUMS256.txt")"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || die "no single published SHA-256 entry for $file (ENV)"
  actual="$(sha256sum "$TMP_DIR/$file" | awk '{ print $1 }')"
  [ "$actual" = "$expected" ] || die "SHA-256 mismatch for $file; archive not extracted"
  log "verified $file against its published SHASUMS256 entry"
  mkdir -p "$TMP_DIR/extract"
  tar -xJf "$TMP_DIR/$file" -C "$TMP_DIR/extract" --strip-components=1
  got="$(node_version_of "$TMP_DIR/extract/bin/node" || true)"
  [ "$got" = "$ver" ] || die "extracted runtime reports '${got:-unavailable}', expected $ver"
  as_root mkdir -p "$(dirname "$prefix")"
  as_root mv "$TMP_DIR/extract" "$prefix"
  end="$(date +%s)"
  log "installed Node $ver at $prefix (download+verify $((end - start)) s; provisional bound ${NODE_DOWNLOAD_MAX_TIME_S} s per request)"
}

ensure_node24() {
  local bin="$NODE24_PREFIX/bin/node" v
  if [ -e "$NODE24_PREFIX" ]; then
    v="$(node_version_of "$bin" || true)"
    if [ "$v" = "$NODE24_VERSION" ]; then
      log "Node 24 present: $bin reports v$v"
      return 0
    fi
    die "$NODE24_PREFIX exists but $bin reports '${v:-unavailable}'; approved is $NODE24_VERSION. Not overwritten: an unexpected system installation. Report this conflict to the owner (ENV)."
  fi
  install_node_verified "$NODE24_VERSION" "$NODE24_PREFIX"
}

main() {
  local mode="full"
  if [ "$#" -gt 1 ]; then usage >&2; die "too many arguments"; fi
  case "${1:-}" in
    "") ;;
    --toolchain-only) mode="toolchain" ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument: $1" ;;
  esac

  local start_total end_total NODE22 NODE24 npm22 npm24 node22_v node24_v
  start_total="$(date +%s)"
  check_tools

  if ! resolve_node22; then
    install_node_verified "$NODE22_SETUP_VERSION" "$NODE22_PREFIX"
    NODE22="$NODE22_PREFIX/bin/node"
    resolve_node22 || die "Node 22 is still not compatible after provisioning (ENV)"
  fi

  ensure_node24
  NODE24="$NODE24_PREFIX/bin/node"
  node24_v="$(node_version_of "$NODE24")"
  [ "$node24_v" = "$NODE24_VERSION" ] || die "NODE24 reports $node24_v, expected $NODE24_VERSION"

  # Each runtime's own bundled npm, with its own bin directory first on PATH.
  npm22="$(PATH="$(dirname "$NODE22"):$PATH" npm --version)"
  npm24="$(PATH="$NODE24_PREFIX/bin:$PATH" "$NODE24_PREFIX/bin/npm" --version)"
  version_ge "$npm24" "$NPM24_MIN" || die "Node 24 npm $npm24 is below $NPM24_MIN required by the Documenso fork (ENV)"
  node22_v="$(node_version_of "$NODE22")"

  # Repository runtime first on PATH; a child script cannot export back to the caller's shell.
  export NODE22 NODE24
  export PATH="$(dirname "$NODE22"):$PATH"

  end_total="$(date +%s)"
  log "NODE22=$NODE22 (v$node22_v, npm $npm22)"
  log "NODE24=$NODE24 (v$node24_v, npm $npm24 >= $NPM24_MIN)"
  log "toolchain provisioning and checks: $((end_total - start_total)) s"

  if [ "$mode" = "toolchain" ]; then
    log "--toolchain-only: stopping before npm ci and product bootstrap (no product was cloned or started)"
    exit 0
  fi

  PRODUCTS_ROOT="${PRODUCTS_ROOT:-$DEFAULT_PRODUCTS_ROOT}"
  case "$PRODUCTS_ROOT" in
    /*) ;;
    *) die "PRODUCTS_ROOT must be an absolute path (got a relative value)" ;;
  esac
  case "$PRODUCTS_ROOT" in
    */node_modules | */node_modules/*) die "PRODUCTS_ROOT must not be inside node_modules" ;;
  esac
  mkdir -p "$PRODUCTS_ROOT" || die "cannot create PRODUCTS_ROOT=$PRODUCTS_ROOT"
  [ -w "$PRODUCTS_ROOT" ] || die "PRODUCTS_ROOT=$PRODUCTS_ROOT is not writable"
  log "PRODUCTS_ROOT=$PRODUCTS_ROOT"

  [ -f package-lock.json ] || die "package-lock.json is missing; cannot run npm ci"
  log "npm ci (Node $node22_v)"
  npm ci

  # All four products are named explicitly: bootstrap's own no-argument default is medusa only.
  NODE24="$NODE24" PRODUCTS_ROOT="$PRODUCTS_ROOT" bash scripts/bootstrap.sh medusa twenty documenso cal
  log "full setup finished"
}

main "$@"
