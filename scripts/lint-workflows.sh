#!/usr/bin/env bash
# Pinned actionlint for the foundation workflow-lint job (plan 9.4). Fails closed: the release archive is
# checked against ACTIONLINT_SHA256 before anything is extracted or run. An empty or malformed checksum stops
# the script before any download.
set -euo pipefail

# Latest actionlint release at the time of this PR (rhysd/actionlint v1.7.12).
ACTIONLINT_VERSION="1.7.12"
# SHA-256 of actionlint_1.7.12_linux_amd64.tar.gz. Source: the linux_amd64 line of
# https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_checksums.txt
ACTIONLINT_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"

if [[ ! "$ACTIONLINT_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "lint-workflows: ACTIONLINT_SHA256 is empty or malformed; refusing to run an unverified actionlint" >&2
  exit 1
fi

archive="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
url="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${archive}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

curl --fail --silent --show-error --location --output "$work/$archive" "$url"
if ! echo "${ACTIONLINT_SHA256}  $work/$archive" | sha256sum --check --status; then
  echo "lint-workflows: checksum mismatch for $archive; refusing to run" >&2
  exit 1
fi
echo "checksum verified for $archive"

tar -xzf "$work/$archive" -C "$work" actionlint
"$work/actionlint"
echo "actionlint ${ACTIONLINT_VERSION} OK"
