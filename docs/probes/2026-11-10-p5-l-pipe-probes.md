# P5 L-PIPE probe record (2026-11-10)

Scope: read-only probes for the DevSecOps scanner lane (L-PIPE). This record performs no build. It runs no product, starts no stack, seeds nothing, changes no setting or ruleset, and makes no outbound change other than the plan branch. Each probe ran in a scratch directory outside this repository (`/home/user/scratch-p5-probe`). Nothing from the scratch directory is committed.

Base: `origin/main` = `5a3a1d9a5c2a63e1f262e3a1e7e4b01cf423e2ec` (F0-3 and F0-4 merged). The first results below were taken at `298ae29`; section 2h re-runs the decisive checks at `5a3a1d9`. Master plan references are `MP:<line>` at `5a3a1d9` (lines 562 and after are +14 from `298ae29`). The plan this record supports is `docs/plans/2026-11-10-p5-l-pipe.md`.

Redaction: no secret, token or credential value appears in this record. Finding output is shown as counts, rule IDs, file and line only. Where a value would be needed, the record names the line and says so.

Status key: **CONFIRMED** (observed, matches the master plan or the stated expectation), **CONTRADICTS** (observed differs from the master plan; stop item), **UNPROBED** (not run, with the reason), **RECORDED** (observed and recorded as a correction or design input; not a contradiction).

## 0. Summary

| Area | Status | Result |
|---|---|---|
| 2a Versions and integrity | CONFIRMED (8 of 9 tools) | Latest semver tag, tag commit SHA and archive SHA-256 recorded for gitleaks, OSV-Scanner, Trivy, Syft, zizmor, actionlint, CodeQL action and bundle, ZAP image. The zizmor SHA-256 is from PyPI. The CodeQL bundle hash is local (no published checksum). |
| 2b Output contract | CONFIRMED | Exit codes for clean, findings and tool error recorded for each tool. Gitleaks exits 1 for both findings and tool error. zizmor exits 0 with findings. |
| 2c Baseline on this repo | CONTRADICTS (PR #3 record only, not the master plan) and RECORDED | Default gitleaks reports 2 hits; only 1 is in the PR #3 allowlist (STOP item A, section 3). CodeQL reports 2 alerts, both security-severity 7.8 (one true positive, one false positive). npm audit reports 10 moderate, all dev-only. OSV reports 1 entry. Trivy reports 0 npm findings (RECORDED coverage gap). |
| 2d Forks and images | CONFIRMED for all six harness images and all four forks | Fork tree and lockfile scans at all four pins; digest resolution, Trivy and Syft on the six harness images by digest. Mailpit and Twenty digest lookups were rate-limited (HTTP 429) and resolved on a later attempt. |
| 2e GitHub behaviour | CONFIRMED by documentation; live behaviour UNPROBED | SARIF permissions, category rule, reusable-workflow limits and fork-PR token rules read from the GitHub docs. Free public upload and out-of-repo alert handling are not stated on the pages read. |
| 2f Runner fit | CONFIRMED for hosts reached; memory UNPROBED | Hosts reached and timings recorded. CodeQL needs about 1.4 GB extracted. Trivy image cache reached 3.1 GB after six image scans. |
| ZAP run | UNPROBED | No stack was started (the probe forbids starting a product by hand; the harness route was not run). The image digest is recorded. |

## 1. Method and environment

| Item | Value |
|---|---|
| Branch | `plan/2026-11-10-p5-l-pipe` created from `origin/main` 298ae29 |
| Tool installs | Release archives or binaries downloaded from the tool's GitHub release. Each verified by SHA-256 against the project's checksum file, or against the PyPI digest for zizmor. No package manager install of a scanner. |
| Upstream reads | Anonymous public git reads (`git ls-remote`, shallow `git fetch` by SHA) through the session proxy. The session's GitHub API access does not cover the upstream tool repositories or the product forks, so no API call was made for them. |
| This repository | `gh api` REST read of PR #3 (`repos/Jayami123/appsec-devsecops-pipeline/pulls/3`). The GitHub GraphQL route was refused for this session. |
| Scratch tools | `zstandard` Python module installed in a scratch virtualenv to unpack the CodeQL bundle (`zstd` is not installed and apt was not available). Nothing installed into the repository or `node_modules`. |
| Environment change | None needed for this probe. Every host the probe reached was reachable through the session proxy. See section 2f. |

## 2a. Versions and integrity

"Latest stable" is the highest semver tag from `git ls-remote --tags` with no pre-release suffix. The GitHub Releases `latest` flag could not be read through the session (the API route for these repositories is denied), so that flag is UNPROBED. The build re-resolves each tag and records it.

| Tool | Latest stable tag | Tag commit (action SHA or source) | Archive or artefact | SHA-256 | Source of SHA-256 | Licence | Min runner |
|---|---|---|---|---|---|---|---|
| gitleaks | v8.30.1 | `83d9cd684c87d95d656c1458ef04895a7f1cbd8e` (lightweight tag) | `gitleaks_8.30.1_linux_x64.tar.gz` | `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` | `gitleaks_8.30.1_checksums.txt` at `https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/` | MIT (LICENSE read) | Linux x64, no runtime |
| OSV-Scanner | v2.7.1 | `02f96a40691c2d155fdda799af436e111231e365` (peeled from annotated tag `7f97ec2c…`) | `osv-scanner_linux_amd64` | `fb7dab19a8bd9bbe5c3189f09d4b7ee1820c9553a23bac202648a56efd2f6ee8` | `osv-scanner_SHA256SUMS` at `https://github.com/google/osv-scanner/releases/download/v2.7.1/` | UNVERIFIED (binary only; licence file not read) | Linux amd64, no runtime; online mode needs `api.osv.dev` |
| Trivy | v0.76.2 | `3f6334d223b52188324af3b9923b4249cd206652` (lightweight) | `trivy_0.76.2_Linux-64bit.tar.gz` | `bc0fc726e017b8927a62b2d3531d7a84ee01769daf5c99ed866dced54089fdbf` | `trivy_0.76.2_checksums.txt` at `https://github.com/aquasecurity/trivy/releases/download/v0.76.2/` | Apache-2.0 (LICENSE read) | Linux 64-bit; needs the vulnerability DB (section 2f) |
| Syft | v1.57.1 | `a0c0d3890a9d79421c403e8fcadec50a2e55bf21` (peeled from annotated tag `33b3234e…`) | `syft_1.57.1_linux_amd64.tar.gz` | `bf52519eb57f675d47c07d43213cb6dff6449f3d6d1147ff6701ed91f44eef0c` | `syft_1.57.1_checksums.txt` at `https://github.com/anchore/syft/releases/download/v1.57.1/` | Apache-2.0 (LICENSE read) | Linux amd64; pulls images from registries |
| zizmor | v1.32.0 | `21bd300700d43d9ba04b0c1fce72a89391ac80b4` (lightweight) | `zizmor-1.32.0-py3-none-manylinux_2_28_x86_64.whl` (PyPI) | `84a6acb975accc13408786a2bd274b572537ca19c933ebbc13e78f3988562071` | PyPI JSON digest at `https://pypi.org/pypi/zizmor/1.32.0/json`; the downloaded wheel's SHA-256 matches | MIT (wheel METADATA) | Linux x86_64 wheel; the GitHub release checksum asset was not found (UNPROBED) |
| actionlint | v1.7.12 | `914e7df21a07ef503a81201c76d2b11c789d3fca` (lightweight) | `actionlint_1.7.12_linux_amd64.tar.gz` | `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8` | `actionlint_1.7.12_checksums.txt` at `https://github.com/rhysd/actionlint/releases/download/v1.7.12/` | MIT (LICENSE read) | Linux amd64 |
| CodeQL action (also provides `upload-sarif`) | v4.39.3 | `33d7b85da1a04171e211befe2c739303b9a4c066` (peeled from annotated tag `f3bbb056…`) | `uses: github/codeql-action/init@<sha>`, `analyze`, `upload-sarif` | n/a (action SHA) | git tag resolution | UNVERIFIED (action licence not read) | Runs on the GitHub-hosted runner |
| CodeQL CLI bundle | bundle `codeql-bundle-v2.27.4` (CLI 2.27.4, from the action's `src/defaults.json` at v4.39.3) | n/a | `codeql-bundle-linux64.tar.zst`, 559,484,083 bytes (matches the HEAD `Content-Length`) | local: `da3e952c7fe978a0b6b93e75d9cbabbdf8535667ca0810bd4b2ae37bc840ffee` | CONFIRMED: `codeql-bundle-linux64.tar.zst.checksum.txt` in release `codeql-bundle-v2.27.4` (`https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.4/codeql-bundle-linux64.tar.zst.checksum.txt`) lists `da3e952c…`, which matches the local hash (section 2h) | CodeQL CLI terms; bundled notices read | Extracted size 1.4 GB |
| ZAP baseline image | `ghcr.io/zaproxy/zaproxy:stable` (moving tag). ZAP release tag v2.17.0 is the highest semver tag; peeled commit `8a1bff313f4d183dba5aa154ecbe89ad751c9153` (tag object `04c5d8be…`). The image tag `2.17.0` resolves to the same index digest (section 2h) | n/a | image index digest `sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af` | n/a (digest pin) | Registry manifest HEAD (ghcr.io) | Apache-2.0 (UNVERIFIED here) | Docker |

Already pinned P2 actions, checked against their tags with `git ls-remote`:

| Action | Tag | Tag commit | Plan pin | Result |
|---|---|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` (MP:705) | CONFIRMED |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | `949feb2413d6458794dcd2491c4babbbce0c15c1` (MP:705) | CONFIRMED |

Harness image references at harness tag `v0.3.1` (commit `7d4a3ae36100a0150397eeac1c6fefefe5e64c15`, read by shallow clone; `docker/*.compose.yml`):

| Reference in harness | Digest resolved (2026-11-10) | Note |
|---|---|---|
| `twentycrm/twenty:${TAG:-v2.44.0}` | `sha256:01fb6d2c00397976fd7613dbeb9703b514b52fb6270339b7a326a2a975d15b26` | Tag is an environment default. Digest resolved on retry after a Docker Hub 429. |
| `axllent/mailpit:v1.22.3` | `sha256:f7f7c31de4de59540ad6515a0ca057a77525bca2069b6e747d873ca66c10fe08` | Same digest on `ghcr.io/axllent/mailpit:v1.22.3`. Resolved on retry. |
| `postgres:15` | `sha256:1aac5b49cefd627f02816141ca4ad012d6cc19460dfe02a9b5168a105be3fc53` | |
| `redis:7` | `sha256:2e3eb11462c4e3759e6972678dd051d150ff54b1e60714b3c33b701260172a90` | OCI index. |
| `inbucket/inbucket` (no tag in harness; resolves to `latest`) | `sha256:48063d73be66889d95c43a6ee18ed5db08e3ad01196d8f7aa1e7f1e6e4625d93` | The harness does not pin this image. The plan pins it by digest (correction 5). |
| `gotenberg/gotenberg:8@sha256:13672f317b443c793e972b1bd2155ec62a3e7b6891b411e8196442cc053ee5f5` | Harness pin exists in the registry (HEAD 200) | The tag `gotenberg/gotenberg:8` now resolves to `sha256:53073e798c8ef39ea2187e44cb67bab77894ea2509100b94c4fe3b461f7b2996`, not the harness pin. The harness pin is kept. |

## 2b. Output contract (per tool)

Commands are run from the scratch clone at 298ae29 (`/home/user/scratch-p5-probe/repo`). Exit codes are observed.

| Tool | Command (as run) | Clean | Findings | Tool error | Output format and keys (observed) |
|---|---|---|---|---|---|
| gitleaks 8.30.1 | `gitleaks dir <repo> --no-banner --redact -f sarif -r <file>` | 0 | 1 (2 results on this repo) | 1 (missing path) | SARIF 2.1.0, driver `gitleaks`. Result keys include `ruleId` (`generic-api-key`), `locations`, `partialFingerprints` (keys `author`, `commitMessage`, `commitSha`, `date`, `email` in dir mode on a git tree). No `level`. No `security-severity`. |
| gitleaks 8.30.1 | `gitleaks git <repo> --no-banner --redact -f json -r <file>` | 0 | 1 | 1 | JSON array of findings, fields include `RuleID`, `File`, `StartLine`, `Fingerprint`. Used for the history scan (40 commits). |
| Trivy 0.76.2 | `trivy fs --cache-dir <c> --scanners vuln --format sarif --quiet -o <file> <dir>` | 0 | 0 (default; `--exit-code 1` makes findings exit 1, observed on `fork-medusa`) | 1 (missing path) | SARIF 2.1.0, driver `Trivy 0.76.2`. On `fork-medusa`: 47 results, keys `level`, `locations`, `message`, `ruleId`, `ruleIndex`. No `partialFingerprints`. Levels `error`, `warning`, `note`. Rule `properties.security-severity` present on 42 rules. |
| Trivy 0.76.2 (JSON) | `trivy fs ... --format json -o <file>`; `trivy image --image-src remote ... --format json -o <file> docker.io/...@sha256:...` | 0 | 0 (default) | 1 | JSON `Results[].Vulnerabilities[]` with `VulnerabilityID`, `PkgName`, `InstalledVersion`, `FixedVersion`, `Severity` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`). `FixedVersion` is the fix-available field used by the thresholds. |
| OSV-Scanner 2.7.1 | `osv-scanner scan source -L <lockfile> --format sarif` (or `--format json`) | 0 | 1 | 127 (missing file, or no extractor for the file) | SARIF 2.1.0, driver `osv-scanner 2.7.1`. 1 result, `level` `warning`, rule property `security-severity` present, `partialFingerprints` key `primaryLocationLineHash`. JSON: `results[].packages[].vulnerabilities[]` with `id`, `affected[].ranges[].events` (contains `{"fixed": "<version>"}` when a fix exists), `database_specific.severity` (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`), `severity`. |
| OSV-Scanner 2.7.1 | `osv-scanner scan source -r <dir>` on a directory with no packages | n/a | n/a | 128 (no packages found) | Observed on an empty directory. |
| npm 10.9.9 | `npm audit --package-lock-only --json` | 0 (not observed; no clean case run) | 1 | 1 (the npm `notice` lines are not errors) | JSON: `metadata.vulnerabilities` (counts by severity), `vulnerabilities{}` keyed by package with `severity`, `isDirect`, `fixAvailable` (boolean, or object with `name`, `version`, `isSemVerMajor`). |
| zizmor 1.32.0 | `zizmor --no-online-audits --format sarif <file-or-dir>` | 0 | 0 (4 findings on the control file; exit code is still 0) | 1 (an audit failed) and 3 (no inputs collected, observed on this repo's `.github/workflows/`) | SARIF 2.1.0, driver `zizmor 1.32.0`. Rules `zizmor/artipacked`, `zizmor/dangerous-triggers`, `zizmor/excessive-permissions`, `zizmor/unpinned-uses`. Levels `error` and `warning`. No `partialFingerprints`. No `security-severity`. |
| actionlint 1.7.12 | `actionlint -no-color <file>` | 0 | 1 (injection control) | 1 (empty file on main) | Text output, one line per finding with `file:line:col`. No SARIF output. |
| CodeQL 2.27.4 | `codeql database create <db> --language=javascript-typescript --source-root=<repo> --overwrite --threads=0` then `codeql database analyze <db> javascript-security-and-quality.qls --format=sarifv2.1.0 --output=<file> --threads=0` | 0 | 0 results is a clean run | non-zero (not observed) | SARIF 2.1.0, driver `CodeQL 2.27.4`. Result keys: `locations`, `message`, `partialFingerprints`, `rule`, `ruleId`, `ruleIndex`. Result `level` is absent. Severity comes from the rule: `rules[ruleIndex].properties["security-severity"]` (string) and `problem.severity`. `partialFingerprints` keys: `primaryLocationLineHash`, `primaryLocationStartColumnFingerprint`. 201 rules, 101 with a security-severity. |
| Syft 1.57.1 | `syft <image-ref> --source-name <name> -o cyclonedx-json=<file> -q` | 0 | not applicable (SBOM only) | non-zero | CycloneDX JSON; count of `components`. |

Minimal redacted SARIF skeletons (keys only; values are placeholders):

```json
{
  "version": "2.1.0",
  "runs": [
    {
      "tool": { "driver": { "name": "gitleaks", "rules": [ { "id": "<ruleId>" } ] } },
      "results": [
        {
          "ruleId": "<ruleId>",
          "locations": [ { "physicalLocation": { "artifactLocation": { "uri": "<path>" }, "region": { "startLine": 0 } } } ],
          "partialFingerprints": { "<key>": "<redacted>" }
        }
      ]
    }
  ]
}
```

```json
{
  "version": "2.1.0",
  "runs": [
    {
      "tool": { "driver": { "name": "CodeQL", "rules": [ { "id": "<ruleId>", "properties": { "security-severity": "<0.0-10.0>", "problem.severity": "warning" } } ] } },
      "results": [
        {
          "ruleId": "<ruleId>",
          "ruleIndex": 0,
          "message": { "text": "<message>" },
          "locations": [ { "physicalLocation": { "artifactLocation": { "uri": "<path>" }, "region": { "startLine": 0 } } } ],
          "partialFingerprints": { "primaryLocationLineHash": "<hash>", "primaryLocationStartColumnFingerprint": "<hash>" }
        }
      ]
    }
  ]
}
```

```json
{
  "version": "2.1.0",
  "runs": [
    {
      "tool": { "driver": { "name": "Trivy 0.76.2", "rules": [ { "id": "<ruleId>", "properties": { "security-severity": "<0.0-10.0>" } } ] } },
      "results": [
        {
          "ruleId": "<ruleId>",
          "level": "error",
          "ruleIndex": 0,
          "message": { "text": "<message>" },
          "locations": [ { "physicalLocation": { "artifactLocation": { "uri": "<path>" } } } ]
        }
      ]
    }
  ]
}
```

```json
{
  "version": "2.1.0",
  "runs": [
    {
      "tool": { "driver": { "name": "zizmor", "version": "1.32.0", "rules": [ { "id": "zizmor/<rule>" } ] } },
      "results": [
        {
          "ruleId": "zizmor/<rule>",
          "level": "error",
          "locations": [ { "physicalLocation": { "artifactLocation": { "uri": "<path>" }, "region": { "startLine": 0 } } } ]
        }
      ]
    }
  ]
}
```

Probe controls for the output contract:

| Control | Command | Expected | Observed |
|---|---|---|---|
| gitleaks positive (synthetic token built at runtime in a scratch dir) | `gitleaks dir <ctrl-pos> -f json` | exit 1, 1 hit | exit 1, 1 hit |
| gitleaks negative (clean scratch file) | `gitleaks dir <ctrl-neg>` | exit 0, 0 hits | exit 0, 0 hits |
| CodeQL positive (`process.argv[2]` into `child_process.exec`) | `codeql database analyze` on the scratch file | at least one `js/…command-line-injection` result | 1 result, `js/indirect-command-line-injection` |
| CodeQL negative (`export const add = (a, b) => a + b;`) | same | 0 results | 0 results |
| CodeQL positive with a plain function parameter (no taint source) | same | expected a hit; not a valid control | 0 results: the first attempt was not a valid positive control, because a function parameter is not a taint source in the default model. Recorded; rewritten with `process.argv`. |
| actionlint positive (`${{ github.event.issue.title }}` in a `run:`) | `actionlint -no-color <file>` | exit 1 with a finding | exit 1, 1 finding line |
| zizmor positive (`pull_request_target` with `ref: ${{ github.event.pull_request.head.sha }}`, unpinned `actions/checkout@v4`) | `zizmor --no-online-audits --format sarif <file>` | at least one finding | 4 findings (`artipacked`, `dangerous-triggers`, `excessive-permissions`, `unpinned-uses`) and exit 0 |
| zizmor without `--no-online-audits` on the same file | same without the flag | findings or a clean run | exit 1, `fatal: no audit was performed`, from the `known-vulnerable-actions` audit. The root cause (token or network) is UNPROBED. |

## 2c. Baseline on this repository (main 298ae29)

### Gitleaks, default rules (`gitleaks dir` and `gitleaks git`, 40 commits)

| Rule | File | Line | Classification | Basis |
|---|---|---|---|---|
| `generic-api-key` | `tests/unit/security/redact.test.ts` | 12 | False positive (synthetic redaction input) | Line is `const out = redactArtefact("<string>");` inside a test that asserts `Bearer [REDACTED]` output. The string is a fixture passed to the redactor. The file header imports only the redaction helpers. |
| `generic-api-key` | `tests/unit/webhooks/vectors.ts` | 28 | False positive (synthetic test key) | PR #3 allowlist entry 16 (`export const DAILY_SECRET_B64 = …`). The file header states the values are throwaway test vectors. |

Comparison with PR #3's 16-line exact-line allowlist (PR #3 body, table "Secret-gate allowlist"):

| Check | Result |
|---|---|
| Each of the 16 verbatim lines still sits at its cited file:line on main 298ae29 | 16 of 16 exact matches (checked by a script that compares the verbatim text at the cited line) |
| Default gitleaks hits covered by the allowlist | 1 of 2 (`vectors.ts:28`). `redact.test.ts:12` is not in the allowlist. |
| Default gitleaks hits on the other 15 allowlist lines | 0 (those lines do not match a default rule, so their entries are redundant under default rules; they are kept because the PR #3 record lists them) |

Allowlist mechanism verified (path-scoped, exact-line, scratch configs only):

| Control | Config | Expected | Observed |
|---|---|---|---|
| Exact-line entry suppresses its line | `[[allowlists]]` with `regexTarget = "line"`, `paths = ['''tests/unit/webhooks/vectors\.ts$''']`, `regexes = ['''^<exact line>$''']` | `vectors.ts:28` not reported | not reported (exit 1 from the other hit only) |
| Same entry does not cover the same line in another path | copy of the line at `tests/unit/other/vectors.ts` | 1 hit | 1 hit |
| Table name | `[[allowlist]]` (singular, array) | gitleaks loads the config | Failed to load config (`'AllowList' expected a map, got 'slice'`). The working table name is `[[allowlists]]`. |
| Path anchor | `paths = ['''^tests/…''']` | matches in dir mode | did not match: dir mode reports the path with the scan root as prefix. The working pattern is unanchored at the start: `tests/unit/webhooks/vectors\.ts$`. |

The line-changed negative control (a different synthetic value on the same line) was inconclusive: the rewritten line was not flagged by the default rules either, so it could not show that the entry stops applying when the line changes. That is recorded as PARTIAL. The anchored full-line regex is the basis for the claim; the path-scope negative above is the observed control.

### npm audit (lockfile only, root `package-lock.json`)

| Severity | Count | Advisory packages | Dev-only | Fix field |
|---|---|---|---|---|
| critical | 0 | none | n/a | n/a |
| high | 0 | none | n/a | n/a |
| moderate | 10 | `@eslint/config-array`, `@eslint/js`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, `eslint`, `minimatch`, `typescript-eslint` | All 10 are dev-only (`npm ls --package-lock-only --omit=dev <name>` fails for each) | 3 boolean `true`; 7 objects, all with `isSemVerMajor: true` (for example `eslint` `9.39.5` and `typescript-eslint` `8.36.0`; these are older than the repo's versions) |

Classification: all 10 are true advisories on dev dependencies. They do not block under D4 (moderate severity; not P5-owned code; not High or Critical). They stay open. No accepted-risk entry is created.

### OSV-Scanner (root `package-lock.json`)

1 entry: `GHSA-g3hv-75wg-m249` on `minimatch@10.2.6`, `MODERATE`, fixed in `11.0.1` (events `introduced 7.0.0`, `fixed 11.0.1`). Same package as one of the npm advisories. Classification: true (dev-only dependency). Non-blocking.

### Trivy (`trivy fs --scanners vuln,secret,misconfig`, repo)

| Target | Findings |
|---|---|
| `package-lock.json` (npm) | 0 vulnerabilities |
| `.cursor/Dockerfile` (misconfig) | `DS-0026` LOW (no HEALTHCHECK); `DS-0029` HIGH ×3 (`apt-get` without `--no-install-recommends`) |
| Secret scanner | 0 |

RECORDED coverage gap (cause corrected): Trivy's default scan leaves out dev dependencies. With `--include-dev-deps` on `5a3a1d9` it reports the minimatch advisory (`CVE-2026-118764`), which npm audit's 10 entries and OSV's one entry also trace to. The plan's root Trivy job therefore uses `--include-dev-deps`, and OSV and npm audit stay (D5). The `.cursor/Dockerfile` misconfigurations are the P2 base image file and are outside P5-owned paths; they are true findings, recorded, and not blocking.

### CodeQL (`javascript-security-and-quality.qls`, repo, 61 JS/TS files and 1 Actions file)

| Rule | File | Line | Rule severity | Classification | Basis |
|---|---|---|---|---|---|
| `js/incomplete-sanitization` | `src/kit/ci/playwright-json-summary.ts` | 183 | security-severity 7.8 (High), precision high | **True positive** | `escapeCell` escapes `|` to `\|` but does not escape backslashes. A backslash in the input before a pipe produces a markdown table break in the job summary. Impact is low (job summary text), but the rule is correct. `src/kit/**` is foundation-owned (MP:347). |
| `js/regex/missing-regexp-anchor` | `tests/unit/kit/import-closure.test.ts` | 53 | security-severity 7.8 (High), precision medium | **False positive** | The alternation `/\/src\/(ci|db|…)\/|\/src\/env\.ts$/` anchors only the `env.ts` branch on purpose. The directory branches are unanchored by design. |

Consequence for the plan (RECORDED): on the first CodeQL run, both alerts are High and in P5-owned code. Under D4 (b) with no baseline, the gate fails. The true positive must be fixed (foundation PR) or the owner must decide otherwise. The false positive needs an owner-reviewed baseline entry or a code-scanning dismissal (owner action).

## 2g. P6 token-scan source (read for PN-7)

Source: `Jayami123/k6-load-concurrency-suite` at `0533e61391b9a64159b32edbeddbbc8b39892997` (the master plan's `0533e61`; resolved by a blobless clone and `git show`). File `scripts/evidence-token-scan.mjs`, 62 lines, 2109 bytes.

| Property | Observed |
|---|---|
| Line 1 | `// Scans evidence files for tokens before they go into a release.` (no provenance header of the L-PIPE form; the L-PIPE copy adds one) |
| Exports | `PATTERNS` (line 9), `findHits(text)` (line 24), `scanTree(root)` (line 42) |
| Patterns | 11 regex literals, lines 8 to 20 (flags `i` and `s` only; no `g`, so `RegExp.test` is not stateful) |
| Output | Prints `TOKEN PATTERN: <relative file> line <n[, n]>` to stderr. Prints no matched text (grep for match or secret output in console calls: 0). |
| Exit codes | 0 with `token scan: clean` on stdout; 1 with `stop: nothing was uploaded` on a hit; 2 with a usage message on a missing argument |
| Missing root | `readdirSync` throws (uncaught; Node exits 1). The plan treats a missing directory as `fail` (section 5.11 test). |

## 2d. Forks and images (read-only; never run)

### Fork source at the bootstrap.sh pins (`scripts/bootstrap.sh` lines 15-18 and 38-41 at 298ae29)

| Fork | Pin (SHA verified by fetch) | gitleaks `dir` hits (exit 1 = hits) | gitleaks run time | OSV entries (exit 1 = findings) | Severity counts (OSV) | OSV run time | Trivy fs total (default flags) | Trivy severity counts | Trivy run time |
|---|---|---|---|---|---|---|---|---|---|
| Cal | `c2b7ac44c66f24ffef1662b276f0653988a609a3` | 206: `generic-api-key` 195, `stripe-access-token` 5, `curl-auth-header` 4, `jwt` 1, `private-key` 1 | 4 s | 517 | CRITICAL 17, HIGH 208, MODERATE 237, LOW 54, UNSPECIFIED 1 | 3 s | 491 (fixable 488) | CRITICAL 17, HIGH 196, MEDIUM 227, LOW 51 | 1 s |
| Documenso | `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` | 21: `generic-api-key` 17, `curl-auth-header` 3, `pkcs12-file` 1 | 1 s | 128 | CRITICAL 5, HIGH 44, MODERATE 65, LOW 14 | 10 s | 109 (fixable 109) | CRITICAL 5, HIGH 36, MEDIUM 56, LOW 12 | under 1 s |
| Medusa starter (`medusa-dtc-starter`) | `f677db438f27294fc50e4c7c6612e71ff38eeff5` | 0 (exit 0) | 1 s | 58 | CRITICAL 2, HIGH 29, MODERATE 22, LOW 5 | 1 s | 47 (fixable 47) | CRITICAL 2, HIGH 24, MEDIUM 19, LOW 2 | under 1 s |
| Twenty (`twenty-CRM`) | `7cbdfec6f346b43715bc2056932f4fad5886f733` | 55: `jwt` 38, `generic-api-key` 15, `private-key` 2 | 10 s | 843 (all lockfiles, recursive) | CRITICAL 16, HIGH 390, MODERATE 380, LOW 57 | 5 s | 319 (fixable 315) | CRITICAL 16, HIGH 131, MEDIUM 149, LOW 23 | 2 s |

Fork findings are report-only under D4 and were not classified (the plan does not require it). The fork hit values were not printed. Counts are per the tool's own entries; an OSV entry is one vulnerability per package, and one advisory can appear on more than one package.

Severity names differ: OSV uses `MODERATE` and Trivy uses `MEDIUM` for the same level. The threshold code normalises `MODERATE` to `MEDIUM`.

### Images (read-only; scanned by digest; never run)

| Image (digest) | Trivy OS | Trivy severity counts | Fixable (`FixedVersion` set) | Trivy time | Syft components | Syft time |
|---|---|---|---|---|---|---|
| `twentycrm/twenty@sha256:01fb6d2c…` | alpine 3.23.5 | CRITICAL 5, HIGH 64, MEDIUM 74, LOW 60 | 203 | 11 s | 2634 | 17 s |
| `postgres@sha256:1aac5b49…` (15) | debian 13.7 | CRITICAL 2, HIGH 91, MEDIUM 162, LOW 144, UNKNOWN 1 | 64 | 7 s | 7281 | 11 s |
| `redis@sha256:2e3eb114…` (7) | debian 12.15 | CRITICAL 1, HIGH 34, MEDIUM 95, LOW 86 | 0 | 3 s | 3088 | 6 s |
| `axllent/mailpit@sha256:f7f7c31d…` (v1.22.3) | (not recorded) | CRITICAL 3, HIGH 76, MEDIUM 115, LOW 38, UNKNOWN 2 | 234 | 3 s | 751 | not timed separately |
| `inbucket/inbucket@sha256:48063d73…` (latest) | alpine 3.22.6 | HIGH 17, MEDIUM 16, LOW 1 | 34 | 2 s | 739 | 4 s |
| `gotenberg/gotenberg@sha256:13672f31…` (harness pin, tag 8) | debian 13.7 | CRITICAL 5, HIGH 434, MEDIUM 473, LOW 527, UNKNOWN 9 | 159 | 50 s | 14841 | 33 s |

Image findings are report-only (D4). Counts are not classified. Trivy and Syft ran with the default DB and cache at `/home/user/scratch-p5-probe/trivy-cache` (3.1 GB after these scans).

The Mailpit and Twenty digest lookups returned HTTP 429 from Docker Hub on the first three attempts (back-offs of 25 s, 60 s and 90 s) and returned digests on the fourth. A later build that pulls anonymously may hit the same limit; see RECORDED-6.

## 2e. GitHub behaviour (documented; live behaviour UNPROBED)

Pages read on 2026-11-10 (WebFetch of the documentation pages).

| Topic | Documented behaviour | Source | Status |
|---|---|---|---|
| SARIF upload permissions | The example workflow sets `security-events: write`, with the comment "required for all workflows". `actions: read` is "only required for workflows in private repositories". The example also sets `contents: read` (no reason given on the page). | `https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github` | CONFIRMED (docs) |
| Free public uploads | The page does not say. It covers only private and internal repositories needing GitHub Code Security or Advanced Security. | same page | UNVERIFIED here; master plan fact 27 cites the review's reading |
| `category` per tool | "When you upload multiple SARIF files for a commit, you must indicate a 'category' for each analysis." A second upload with the same category and tool overwrites the first. Multiple uploads for the same tool and category fail. | same page | CONFIRMED (docs) |
| Alerts from paths outside this repository, or files not in the repository | The page does not address it. It says only that `partialFingerprints` need the SARIF and the source code in the repository. | same page | UNPROBED (no live upload in this probe) |
| Reusable workflow permissions | "permissions can only be maintained or reduced—not elevated—throughout the chain." A called workflow cannot get more permissions than its caller. | `https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows` | CONFIRMED (docs); supports MP:666 and fact 28 |
| Secrets to a reusable workflow | `secrets: inherit` passes the caller's secrets to the directly called workflow only ("Secrets are only passed to directly called workflow"). Maximum ten levels; no loops. | same page | CONFIRMED (docs) |
| Fork pull request token | "The `GITHUB_TOKEN` has read-only permissions in pull requests from forked repositories." | `https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows` (pull_request section) | CONFIRMED (docs) |
| Fork pull request secrets | "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository." | same page | CONFIRMED (docs) |
| `pull_request_target` | Runs in the base-repository default-branch context. The page warns about "granting unintended access to write privileges or secrets". | same page | CONFIRMED (docs); the plan does not use it (9.11 test 6) |
| Effect of the same-repo `if:` on a fork pull request | A job whose `if:` checks `head.repo.full_name == github.repository` is skipped on a fork PR. The gate then sees a skipped scan job. Under MP:681 rule (3), `p5_scans` is true for every PR, so the gate fails. | Derived from the two rows above and MP:679-681 | Documented inputs CONFIRMED; the live outcome on a fork PR is UNPROBED (no fork PR was opened) |

## 2f. Runner fit (disk, time, network)

Measured on the probe host (not the GitHub-hosted runner; the runner's own limits are UNPROBED).

| Work | Hosts reached (observed) | Time | Disk |
|---|---|---|---|
| gitleaks binary | `github.com` (release download) | download not timed separately | 8.2 MB archive; 22 MB binary |
| OSV-Scanner | `github.com` (release); `api.osv.dev` (POST queries succeeded; GET returns 405 by design) | 3 to 10 s per tree (scan only) | 58 MB binary |
| Trivy binary and DB | `github.com` (release); Trivy DB OCI repository (default order `mirror.gcr.io/aquasec/trivy-db:2`, then `ghcr.io/aquasecurity/trivy-db:2`, per `trivy image --help`). Which one served the DB was not recorded. | DB download not timed separately; scans 0 to 50 s | binary 176 MB; cache 3.1 GB after six image scans |
| Trivy and Syft image pulls | `registry-1.docker.io`, `auth.docker.io` (token); manifest HEAD succeeded; blob redirect host not recorded | 2 to 50 s per image | cache counted above |
| ZAP image digest | `ghcr.io` (token and manifest HEAD succeeded) | not pulled | not measured |
| npm audit | `registry.npmjs.org` (`npm audit` bulk advisory endpoint) | under 5 s | none |
| CodeQL bundle | `github.com` (release download; complete at 559 MB) | about 2 min for the download (background) | bundle 559 MB; extracted 1.4 GB |
| CodeQL database create and analyze | local (no network needed once the bundle is present) | create 7 s; analyze 20 s (javascript-security-and-quality, repo) | database size not recorded |
| zizmor | `files.pythonhosted.org` (wheel, 9.7 MB, about 2 min); `pypi.org` (JSON); online audit needs a GitHub API token (the `known-vulnerable-actions` audit failed without one; see section 2b) | wheel 2 min | 9.7 MB wheel |
| Node 24 (setup phase, not used by this probe) | `nodejs.org` (redirects; plan MP:787) | not run | not run |

Domains the lane needs (exact hostnames; wildcards are not permitted in environment allowlists):

| Host | Used by | Reached by this probe |
|---|---|---|
| `github.com` | tool release downloads, CodeQL bundle, action pins | yes |
| `objects.githubusercontent.com` and `release-assets.githubusercontent.com` | release asset redirects | reachable (HTTP 404 on root; not a failure) |
| `api.github.com` | zizmor online audits (if enabled), owner checks | yes (anonymous only) |
| `ghcr.io` | ZAP image; Trivy DB fallback; Trivy and Syft image pulls | yes |
| `mirror.gcr.io` | Trivy DB first choice | not confirmed which host served the DB (UNVERIFIED) |
| `registry-1.docker.io`, `auth.docker.io` | Postgres, Redis, Mailpit, Inbucket, Gotenberg, Twenty images | yes (429 under anonymous load) |
| `api.osv.dev` | OSV-Scanner online queries | yes (POST) |
| `registry.npmjs.org` | npm audit, `npm ci` | yes |
| `files.pythonhosted.org`, `pypi.org` | zizmor wheel and digest | yes |
| `nodejs.org` | setup-phase Node 24 (not in this probe) | reachable; not run |

Note: the probe needed no Docker daemon. Trivy and Syft pull images directly from the registry.

## 2h. Re-run at 5a3a1d9 (this revision)

Commands run from the repository root unless stated. "Scratch" means a copy under `/home/user/scratch-p5-probe` (`git archive 5a3a1d9`, with `node_modules` linked from the repository). No file in the repository was edited by these runs.

| Check | Command | Expected | Observed |
|---|---|---|---|
| gitleaks default, root, exit code 2 | `gitleaks dir . --no-banner --redact -f json -r <out> --exit-code 2` | 2, 2 hits | 2, 2 hits (`tests/unit/security/redact.test.ts`, `tests/unit/webhooks/vectors.ts`) |
| fixture form, concatenated (scratch; run with `--exit-code 2`) | file line `redactArtefact("key=" + "api_" + "9f8e7d6c5b4a3210zz");` | 0 | 0, 0 hits (exit 0 with the flag; exit 0 without it) |
| fixture form, join (scratch; run with `--exit-code 2`) | file line `redactArtefact(["key=api", "9f8e7d6c5b4a3210zz"].join("_"));` | 2 with the flag | 1 hit, exit 2 with `--exit-code 2`; exit 1 without the flag |
| fixture form, plain literal (scratch; run with `--exit-code 2`) | file line `redactArtefact("key=api_9f8e7d6c5b4a3210zz");` | 2 with the flag | 1 hit, exit 2 with `--exit-code 2`; exit 1 without the flag |
| gitleaks git, PR range | `gitleaks git . --log-opts="5a3a1d9..HEAD" --exit-code 2` | 0 | 0, 0 hits |
| allowlist uniqueness | count of each verbatim PR #3 line in the file at HEAD | 1 each | 1 each, 16 of 16 |
| Trivy default, root | `trivy fs --scanners vuln --format json` | 0 vulnerabilities | 0 |
| Trivy with dev deps, root | `trivy fs --include-dev-deps --scanners vuln --format json` | one MEDIUM, minimatch | `CVE-2026-118764`, minimatch, MEDIUM, fix 11.0.1 |
| zizmor offline, workflows | `zizmor --no-online-audits --format sarif .github/workflows` | exit 0, 13 results, 0 error | exit 0, 13 results: 5 `secrets-inherit` (warning), 8 `self-repository` (note), 0 error |
| classifier, `tests/unit/scan` path | `printf 'tests/unit/scan/x.test.ts\n' \| EVENT_NAME=pull_request BEFORE_SHA= bash scripts/ci-changes.sh` | codeql only | every lane `true` (`ci-changes.sh:56-57`) |
| node type stripping | `node --experimental-strip-types t.ts` (`const x: number = 2`) | prints 2, exit 0 | 2, exit 0 |
| scratch tree, F0-5a edits, gitleaks | as the first row, on the scratch tree | 1 hit (`vectors.ts`) | 1 hit (`tests/unit/webhooks/vectors.ts`), exit 1 without `--exit-code 2` |
| scratch tree, F0-5a edits, CodeQL | `codeql database create` then `analyze` with `javascript-security-and-quality.qls` | 0 results | 0 results (escapeCell and import-closure edits applied) |
| scratch tree, F0-5a edits, unit | `node --test "tests/unit/**/*.test.ts"` | all pass | 335 pass, 0 fail (main 334; one separate `escapeCell` test added) |
| scratch tree, F0-5a edits, typecheck | `tsc -p tsconfig.json` | exit 0 | exit 0 |
| CodeQL bundle checksum | `curl` of `codeql-bundle-linux64.tar.zst.checksum.txt` (URL in section 2a) | `da3e952c…` | `da3e952c7fe978a0b6b93e75d9cbabbdf8535667ca0810bd4b2ae37bc840ffee` (matches the local hash) |
| ZAP image tag | ghcr manifest HEAD for `zaproxy/zaproxy:2.17.0` | `sha256:9624669d…` | `sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af` (same as `stable`) |
| harness commands (read-only, `qa-portfolio-harness` at `v0.3.1`) | read `package.json` `scripts` and `scripts/up.mjs`, `down.mjs`, `smoke.mjs` | up, down and smoke commands | `npm run up -- <id>` → `node scripts/up.mjs <id>`; `npm run down -- <id>` → `node scripts/down.mjs <id>`; `npm run smoke -- <id> [--dry-run]` → `node scripts/smoke.mjs`. Product ids from `parseProductId` (`scripts/lib.mjs`). No stack was started. |

The scratch fixture line used in the rows above is the synthetic value from the redaction test; it is built from parts in the fixed form and is not committed in its final form.

## 3. Contradictions, stops and recorded corrections

### STOP-A (owner decision needed before the build): default gitleaks flags a line the PR #3 allowlist omits

- Master plan expectation (P5-SCAN-002, MP:1051): blocking gitleaks, with a clean tree passing.
- PR #3 record (its body, "Secret-gate allowlist" and "Verification at head"): "Secret gate over all 17 commits, with the 16-line allowlist: 0 unreviewed hits."
- Observed on main 298ae29 with gitleaks 8.30.1 default rules: 2 hits. `tests/unit/webhooks/vectors.ts:28` is allowlist entry 16. `tests/unit/security/redact.test.ts:12` is not in the allowlist.
- Why it matters: the scanner gate would fail on main with the default rules until either an exact-line entry is added or the fixture line is changed.
- Superseded (plan correction 15): F0-5a changes the redaction fixture so default gitleaks exits 0 on that line (section 2h). No 17th entry is needed. The F0-5a fixture form is in section 11.1 of the plan.
- Note: PR #3's own gate was a custom check, not gitleaks. Its "0 unreviewed hits" claim is accurate for that gate and does not show that default gitleaks passes.

### RECORDED-1: CodeQL true positive in foundation-owned code

`src/kit/ci/playwright-json-summary.ts:183` (`escapeCell`) is a High true positive. The first CodeQL run on main will fail the gate unless it is fixed or owner-decided. The fix is a foundation PR (`src/kit/**`). See section 2c.

### RECORDED-2: zizmor exit code is 0 with findings

zizmor 1.32.0 exits 0 with 4 findings on the control file. The threshold must read the SARIF (any result at level `error`), not the exit code. The plan's PN-6 rule ("blocking on errors") uses the SARIF level.

### RECORDED-3: gitleaks exit codes (resolved with `--exit-code 2`)

With `--exit-code 2`: 0 clean, 2 leaks, 1 tool error (section 2h; a missing path gives 1). Without the flag, leaks exit 1, the same as a missing path (section 2b).

Earlier wording, kept for the record: a missing path gives exit 1, the same as a leak. The threshold must check that the SARIF or JSON file exists, parses, and has `invocations[0].executionSuccessful` set (for SARIF) before it trusts a `fail`. A missing or unparseable output is `fail` by fail-closed rule (NEW-PIPE-2).

### RECORDED-4: Trivy's default scan leaves out dev dependencies

Trivy 0.76.2 leaves out dev dependencies by default. On `5a3a1d9`, `--include-dev-deps` reports `CVE-2026-118764` (minimatch, MEDIUM, fix 11.0.1). npm audit's 10 moderate entries and OSV's one entry all trace to the same advisory, `GHSA-g3hv-75wg-m249`. The root Trivy job therefore runs with `--include-dev-deps` (plan 5.4). OSV is the primary dependency gate; npm audit is the D5 cross-check (section 2h).

### RECORDED-5: Trivy SARIF has no partialFingerprints

The Trivy SARIF used for upload has no `partialFingerprints`. Newness uses the Trivy JSON fields (the plan's correction 4).

### RECORDED-6: Docker Hub anonymous rate limit

Docker Hub returned HTTP 429 for the Mailpit and Twenty manifest lookups on three attempts (back-offs of 25 s, 60 s and 90 s), then returned digests on the fourth. This is an ENV finding (not a PRODUCT BUG or a TEST BUG). A later build that pulls anonymously at scale may hit it.

### RECORDED-7: `inbucket/inbucket` is untagged in the harness

The harness references `inbucket/inbucket` with no tag (`docker/documenso.compose.yml:29`), so it resolves to `latest`. The plan pins it by digest.

### RECORDED-8: the gotenberg tag and the harness digest differ

The harness pin `gotenberg/gotenberg:8@sha256:13672f31…` exists in the registry. The tag `gotenberg/gotenberg:8` now points to `sha256:53073e79…`. The plan keeps the harness pin because the harness defines the image.

### RECORDED-9: P5-SCAN-002 control "clean tree passes"

Because STOP-A applies, a clean-tree control cannot pass on main as the tree stands. The plan's control for P5-SCAN-002 uses the synthetic runtime token (positive) and a clean scratch tree (negative), and states the main-tree result separately.

## 4. UNPROBED items (with reasons)

| Item | Reason | Settles it |
|---|---|---|
| ZAP baseline run (P5-SCAN-004) | Running it needs a harness stack. The probe does not start a product by hand, and the harness route was not run. | A throwaway-stack run through the harness at v0.3.1 with `down` in `finally`, in the build (MP:1053, MP:348). |
| ZAP image version inside the pinned digest | Not run. | The same run; `zap-baseline.py --version` inside the pinned image. |
| Live SARIF upload behaviour (free public upload; out-of-repo alerts) | No upload to this repository was made. The probe did not open a PR with SARIF. | A draft build PR with one scanner upload, checked against the code-scanning page. |
| Live fork PR behaviour (same-repo `if:` skip, gate result) | No fork PR was opened (no fork exists in this session and the probe does not change the repo's PRs). | Owner-run fork PR on the built gate (NEW-PIPE-6). |
| GitHub Releases `latest` flag for each tool | The GitHub API route for these repositories is denied for this session. Highest semver tag used instead. | The build re-reads each tag and release; recorded in the PR body. |
| zizmor GitHub release checksum asset | Not found (`zizmor-x86_64-unknown-linux-gnu.tar.gz.sha256` returned 404). The PyPI digest is the source. | Build confirms against the release page at build time. |
| Licences for OSV-Scanner, ZAP, CodeQL CLI | Binary or image only; licence files not read. | Build reads the licence file in the release or repository. |
| zizmor online audit root cause | The audit failed without a token; the probe did not supply one. | Build tests `GH_TOKEN` read-only; the plan uses `--no-online-audits` unless the owner decides otherwise. |
| Trivy DB host actually used | Not recorded by the probe. | Build records `trivy version --format json` DB metadata. |
| Memory use per scan | Not measured (the probe host is not the runner). | Build measures on a runner with `/usr/bin/time -v`. |
| Blob redirect hosts for Docker Hub pulls | Not recorded. | Build records the host from a verbose pull. |
| Full harness pin check of the images' runtime use | Not in scope. The probe scanned digests; it did not run them. | Harness work (not this lane). |
| Gitleaks line-changed negative control | Inconclusive (rewritten synthetic line was not flagged by default rules). | Build uses a scratch file with a rule-matching line. |
| CodeQL and Trivy fork-side SARIF uploads | Fork scans are report-only and were run as JSON or local output only. | Build (SCAN-001 image scans) |
| Syft and Trivy SBOM content checks against the harness compose files | Not in scope. | PN-5 build |
