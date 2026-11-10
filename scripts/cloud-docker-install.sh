#!/usr/bin/env bash
# Installs Docker Engine for a Claude Code cloud setup script. Ubuntu 24.04 "noble" only.
# Pins and daemon config match .cursor/Dockerfile, Docker block (lines 45-63): docker-ce and docker-ce-cli
# 5:28.5.2-1~ubuntu.24.04~noble, containerd.io, docker-buildx-plugin, docker-compose-plugin, fuse-overlayfs,
# iptables (iptables-legacy alternatives), and /etc/docker/daemon.json with storage-driver fuse-overlayfs.
# Source: the official Docker apt repository, its GPG key checked by fingerprint and stored in
# /etc/apt/keyrings/docker.gpg (signed-by). No convenience script and no curl-to-shell.
#
#   bash scripts/cloud-docker-install.sh             install (idempotent)
#   bash scripts/cloud-docker-install.sh --dry-run   print the planned commands; change nothing; exit 0
#
# Does NOT start dockerd: .claude/hooks/start-docker.sh does that at session start.
# Does NOT add users to the docker group: the hook and this script run as root or through sudo, so the
# group is not needed. Add it only for a non-root login shell, and say why in that PR.
# A dockerd already installed at another version (the Claude Code cloud image ships 29.9.2) is preinstalled
# by the platform: the script prints "using preinstalled dockerd <ver> ..." and exits 0 without installing or
# changing anything, also with --dry-run. The 28.5.2 pin applies only when this script installs Docker.
# Exit 1 with "cloud-docker-install: ERROR" on: a non-noble OS, an unsupported architecture, a key fingerprint
# mismatch, a daemon.json that differs, any apt failure, or a post-install version that is not 28.5.2.
#
# Overrides (tests and non-standard hosts only):
#   START_DOCKER_SUDO  prefix for privileged commands. Default: empty when root, else "sudo". "" means none.
#   OS_RELEASE_FILE    os-release file to read. Default: /etc/os-release.
set -euo pipefail

DOCKER_VERSION_PIN="28.5.2"
DOCKER_PKG_VERSION="5:28.5.2-1~ubuntu.24.04~noble"
DOCKER_KEY_FPR="9DC858229FC7DD38854AE2D88D81803C0EBFCD88"
DOCKER_APT_URL="https://download.docker.com/linux/ubuntu"
DOCKER_KEY_URL="$DOCKER_APT_URL/gpg"
DOCKER_PACKAGES=(
  "docker-ce=$DOCKER_PKG_VERSION"
  "docker-ce-cli=$DOCKER_PKG_VERSION"
  containerd.io
  docker-buildx-plugin
  docker-compose-plugin
  fuse-overlayfs
  iptables
)
DAEMON_JSON_CONTENT='{
  "storage-driver": "fuse-overlayfs"
}'

die() { printf 'cloud-docker-install: ERROR %s\n' "$*" >&2; exit 1; }
log() { printf 'cloud-docker-install: %s\n' "$*"; }

if [ -n "${START_DOCKER_SUDO+set}" ]; then
  SUDO="$START_DOCKER_SUDO"
elif [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi
run() { if [ -n "$SUDO" ]; then "$SUDO" "$@"; else "$@"; fi; }

DRY_RUN=0
case "${1:-}" in
  "") ;;
  --dry-run) DRY_RUN=1 ;;
  *) die "unknown argument '$1' (usage: bash scripts/cloud-docker-install.sh [--dry-run])" ;;
esac

TMP_DIR=""
cleanup() { if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then rm -rf "$TMP_DIR"; fi; }
trap cleanup EXIT

# 1. Operating system: the pins are noble-specific.
OS_FILE="${OS_RELEASE_FILE:-/etc/os-release}"
[ -r "$OS_FILE" ] || die "cannot read $OS_FILE"
os_line="$( (. "$OS_FILE" && printf '%s %s %s' "${ID:-}" "${VERSION_ID:-}" "${VERSION_CODENAME:-}") )"
read -r os_id os_ver os_codename <<<"$os_line"
if [ "$os_id" != "ubuntu" ] || [ "$os_ver" != "24.04" ] || [ "$os_codename" != "noble" ]; then
  die "supports Ubuntu 24.04 (noble) only; found ID=${os_id:-unset} VERSION_ID=${os_ver:-unset} VERSION_CODENAME=${os_codename:-unset}. No change made."
fi

# 2. Architecture: the apt source is built for the dpkg architecture.
command -v dpkg >/dev/null 2>&1 || die "dpkg is not available; cannot select the apt architecture"
ARCH="$(dpkg --print-architecture)"
case "$ARCH" in
  amd64 | arm64) ;;
  *) die "unsupported architecture '$ARCH' (supported: amd64, arm64). No change made." ;;
esac

# 3. Installed daemon: idempotent when it is the pinned version. Any other installed version is preinstalled
#    by the platform image: it is left as is, nothing is installed, and the script exits 0.
INSTALLED=""
if command -v dockerd >/dev/null 2>&1; then
  INSTALLED="$(dockerd --version 2>/dev/null | sed -n 's/^Docker version \([0-9][0-9.]*\).*/\1/p' | sed -n '1p' || true)"
fi
if [ -n "$INSTALLED" ] && [ "$INSTALLED" != "$DOCKER_VERSION_PIN" ]; then
  log "using preinstalled dockerd $INSTALLED from the platform image; the $DOCKER_VERSION_PIN pin applies only when this script installs Docker. No change made."
  exit 0
fi
if [ "$INSTALLED" = "$DOCKER_VERSION_PIN" ] && [ "$DRY_RUN" -eq 0 ]; then
  log "docker $DOCKER_VERSION_PIN already installed"
  exit 0
fi

# 4. Dry run: print the planned commands only.
if [ "$DRY_RUN" -eq 1 ]; then
  log "dry-run: no change will be made. Planned commands, in order:"
  printf '  install -m 0755 -d /etc/apt/keyrings\n'
  printf '  curl --retry 3 -fsSL -o <tmp>/docker.asc %s\n' "$DOCKER_KEY_URL"
  printf '  check the key fingerprint is %s, then gpg --dearmor to /etc/apt/keyrings/docker.gpg (mode 0644)\n' "$DOCKER_KEY_FPR"
  printf '  write /etc/apt/sources.list.d/docker.list: deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] %s noble stable\n' "$ARCH" "$DOCKER_APT_URL"
  printf '  apt-get update\n'
  printf '  apt-get install -y %s\n' "${DOCKER_PACKAGES[*]}"
  printf '  update-alternatives --set iptables /usr/sbin/iptables-legacy\n'
  printf '  update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy\n'
  printf '  write /etc/docker/daemon.json (refused if it exists with other content)\n'
  printf '  verify dockerd --version reports %s\n' "$DOCKER_VERSION_PIN"
  exit 0
fi

# 5. Apply. Every step fails loudly through set -e.
command -v gpg >/dev/null 2>&1 || die "gpg is not available (install gnupg first)"
TMP_DIR="$(mktemp -d)"
export DEBIAN_FRONTEND=noninteractive

run install -m 0755 -d /etc/apt/keyrings
curl --retry 3 --retry-delay 5 -fsSL -o "$TMP_DIR/docker.asc" "$DOCKER_KEY_URL" \
  || die "could not download the Docker apt key from $DOCKER_KEY_URL"
fingerprints="$(gpg --show-keys --with-colons "$TMP_DIR/docker.asc" 2>/dev/null | awk -F: '$1 == "fpr" { print $10 }')"
case $'\n'"$fingerprints"$'\n' in
  *$'\n'"$DOCKER_KEY_FPR"$'\n'*) ;;
  *) die "the downloaded Docker apt key does not contain the expected fingerprint $DOCKER_KEY_FPR; nothing installed" ;;
esac
gpg --dearmor -o "$TMP_DIR/docker.gpg" "$TMP_DIR/docker.asc"
run install -m 0644 "$TMP_DIR/docker.gpg" /etc/apt/keyrings/docker.gpg

printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] %s noble stable\n' "$ARCH" "$DOCKER_APT_URL" > "$TMP_DIR/docker.list"
run install -m 0644 "$TMP_DIR/docker.list" /etc/apt/sources.list.d/docker.list

run apt-get update
run apt-get install -y "${DOCKER_PACKAGES[@]}"

run update-alternatives --set iptables /usr/sbin/iptables-legacy
run update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

printf '%s\n' "$DAEMON_JSON_CONTENT" > "$TMP_DIR/daemon.json"
if [ -e /etc/docker/daemon.json ]; then
  cmp -s /etc/docker/daemon.json "$TMP_DIR/daemon.json" \
    || die "/etc/docker/daemon.json exists with different content; not replaced. Resolve it deliberately."
else
  run install -d -m 0755 /etc/docker
  run install -m 0644 "$TMP_DIR/daemon.json" /etc/docker/daemon.json
fi

# 6. Verify the installed version is the pin.
INSTALLED="$(dockerd --version 2>/dev/null | sed -n 's/^Docker version \([0-9][0-9.]*\).*/\1/p' | sed -n '1p' || true)"
[ "$INSTALLED" = "$DOCKER_VERSION_PIN" ] || die "after install dockerd reports '${INSTALLED:-none}', expected $DOCKER_VERSION_PIN"
log "installed docker $DOCKER_VERSION_PIN (dockerd not started; the session hook starts it)"
