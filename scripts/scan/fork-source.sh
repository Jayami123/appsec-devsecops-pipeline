#!/usr/bin/env bash
# Fetches one product fork at its pinned commit (config/scan/forks.json, equal to scripts/bootstrap.sh) with a
# shallow fetch into <dest>. Refuses any pin that is not a full 40-hex commit id, before any network call.
# Usage: fork-source.sh <product> <dest>. Exit 2 = refused; other non-zero = fetch failure.
set -euo pipefail

product="${1:-}"
dest="${2:-}"
if [[ -z "$product" || -z "$dest" ]]; then
  echo "usage: fork-source.sh <product> <dest>" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
manifest="${SCAN_FORKS_MANIFEST:-$root/config/scan/forks.json}"

read_field() {
  node -e '
    const [file, product, field] = process.argv.slice(1);
    const doc = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
    const entry = doc.forks && doc.forks[product];
    const value = entry ? entry[field] : undefined;
    process.stdout.write(value === undefined ? "" : String(value));
  ' "$manifest" "$product" "$1"
}

ref="$(read_field ref)"
url="$(read_field url)"
if [[ -z "$url" ]]; then
  echo "fork-source: no entry for '$product' in $manifest; refusing" >&2
  exit 2
fi
if [[ ! "$ref" =~ ^[0-9a-f]{40}$ ]]; then
  echo "fork-source: '$product' pin is not a 40-hex commit id; refusing" >&2
  exit 2
fi

mkdir -p "$dest"
git -C "$dest" init -q
git -C "$dest" remote add origin "$url"
git -C "$dest" fetch -q --depth 1 origin "$ref"
git -C "$dest" checkout -q --detach FETCH_HEAD
echo "fork-source: $product at $ref"
