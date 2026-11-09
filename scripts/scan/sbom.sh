#!/usr/bin/env bash
# Syft SBOM per pinned image (plan 5.7, 11.8). Reads config/scan/images.json, refuses any entry without a
# sha256 digest, writes one CycloneDX JSON per image into <outdir>, and checks that each file parses with at
# least one component. Usage: sbom.sh <outdir>. Exit 0 = verdict=pass; 2 = refused input; 1 = verdict=fail.
set -uo pipefail

outdir="${1:-}"
if [[ -z "$outdir" ]]; then
  echo "usage: sbom.sh <outdir>" >&2
  exit 2
fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
manifest="${SCAN_IMAGES_MANIFEST:-$root/config/scan/images.json}"
syft="${SYFT_BIN:-syft}"
mkdir -p "$outdir"

# Every entry must carry a sha256 digest; the scan reads "repo@digest" only (no tags).
refs="$(node -e '
  const fs = require("node:fs");
  const doc = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  for (const image of doc.images ?? []) {
    if (!/^sha256:[0-9a-f]{64}$/.test(String(image.digest))) {
      console.error(`sbom: ${image.name} has no sha256 digest; refusing`);
      process.exit(2);
    }
    console.log(`${image.name} ${image.repo}@${image.digest}`);
  }
' "$manifest")" || exit 2

fail=0
while read -r name ref; do
  out="$outdir/$name.cdx.json"
  code=0
  "$syft" "$ref" -o "cyclonedx-json=$out" -q || code=$?
  if [[ "$code" -ne 0 ]]; then
    echo "sbom: syft failed on $name ($code)" >&2
    fail=1
    continue
  fi
  if ! node -e '
    const fs = require("node:fs");
    const doc = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (doc.bomFormat !== "CycloneDX" || (doc.components ?? []).length < 1) process.exit(1);
  ' "$out"; then
    echo "sbom: $name has no CycloneDX components" >&2
    fail=1
  fi
done <<< "$refs"

if [[ "$fail" -ne 0 ]]; then
  echo "verdict=fail"
  exit 1
fi
echo "verdict=pass"
