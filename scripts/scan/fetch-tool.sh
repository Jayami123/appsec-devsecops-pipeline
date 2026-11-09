#!/usr/bin/env bash
# Fetches one pinned scanner archive from config/scan/tools.json, checks its SHA-256, and installs the
# member binary into $RUNNER_TEMP/tools (or a temp dir outside the repository). Fails closed: an empty or
# malformed checksum stops the script before any download, and a mismatch stops it before extraction.
# Formats: tar.gz (member inside the archive) or binary (the download is the tool). Exit 2 = refused (config or checksum). Any other non-zero exit is a download or extract failure.
set -euo pipefail

name="${1:-}"
if [[ -z "$name" ]]; then
  echo "usage: fetch-tool.sh <tool>" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
manifest="${SCAN_TOOLS_MANIFEST:-$root/config/scan/tools.json}"

read_field() {
  node -e '
    const [file, tool, field] = process.argv.slice(1);
    const doc = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
    const entry = doc.tools && doc.tools[tool];
    const value = entry ? entry[field] : undefined;
    process.stdout.write(value === undefined ? "" : String(value));
  ' "$manifest" "$name" "$1"
}

version="$(read_field version)"
url="$(read_field url)"
sha256="$(read_field sha256)"
member="$(read_field member)"
format="$(read_field format)"
format="${format:-tar.gz}"

if [[ -z "$version" || -z "$url" || -z "$member" ]]; then
  echo "fetch-tool: '$name' is not fully described in $manifest; refusing" >&2
  exit 2
fi
if [[ ! "$sha256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "fetch-tool: '$name' SHA-256 is empty or malformed; refusing to download" >&2
  exit 2
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [[ -n "${SCAN_TOOLS_DIR:-}" ]]; then
  dest="$SCAN_TOOLS_DIR"
elif [[ -n "${RUNNER_TEMP:-}" ]]; then
  dest="$RUNNER_TEMP/tools"
else
  dest="$(mktemp -d)/tools"
fi
mkdir -p "$dest"

archive="$work/archive.tar.gz"
curl --fail --silent --show-error --location --output "$archive" "$url"
actual="$(sha256sum "$archive" | cut -d' ' -f1)"
if [[ "$actual" != "$sha256" ]]; then
  echo "fetch-tool: $name checksum mismatch (expected $sha256); refusing to run" >&2
  exit 2
fi

case "$format" in
  tar.gz)
    tar -xzf "$archive" -C "$work" "$member"
    install -m 0755 "$work/$member" "$dest/$member"
    ;;
  binary)
    # A raw release binary: the verified download is the tool itself.
    install -m 0755 "$archive" "$dest/$member"
    ;;
  *)
    echo "fetch-tool: $name has unsupported format '$format'; refusing" >&2
    exit 2
    ;;
esac
echo "$name $version sha256 OK"
echo "$dest/$member"
