# Cloud environments: owner handoff (F0-1 correction)

This page lists the steps for the two cloud providers. The builder does not select, save or activate
any environment, and nothing here is a claim that a provider ran a committed command unless the status
says PASS. Status keys: **PASS** = observed in a real run in this build; **SIMULATED** = exercised
locally with fake runtimes, not in a provider session; **UNPROBED** = not observed; **ENV** = an
observed blocker with its sanitized cause.

## Runtime selection contract

Every runtime is selected through one contract, shared by `scripts/cloud-install.sh`,
`scripts/bootstrap.sh`, `.claude/hooks/session-start.sh` and `.cursor/Dockerfile`.

| Item | Rule |
|---|---|
| Toolchain root | `QA_TOOLCHAIN_ROOT` if set (must be absolute), else `$HOME/.cache/qa-portfolio/toolchains` |
| Node 24 (Documenso only) | exact `24.22.0` at `$root/node/24.22.0/bin/node`; exported as absolute `NODE24` |
| Node 22 (repository runtime) | compatible runtime first on `PATH` (`>= 22.22.0`, family 22); else `$root/node/22.23.3` |
| Validity | a side-by-side install is valid only with `.qa-toolchain-manifest` and an exact reported version |
| Provisioning | download to a private staging directory; verify the archive SHA-256 against its published SHASUMS256 entry; extract; verify the reported version; write the manifest; promote with an atomic rename |
| Reuse | a valid installation is reused without download |
| Conflict | a non-valid, symlinked or otherwise conflicting target fails the run and is not modified |
| Legacy `/opt/node24` | never selected, never overwritten. It is reported as informational only |

**Bounded deviation from the master plan (record):** §10.2 described extraction to `/opt/node24`. This
build selects a side-by-side path under the contract root instead, so an unexpected system installation
at `/opt/node24` cannot be selected or replaced silently. The pin is unchanged. A future CI workflow must
export the same absolute `NODE24` from the same contract; no CI is implemented here.

**Pin rationale:** `24.22.0` is kept exactly for reproducibility. Documenso requires Node `>= 24` and
npm `>= 11.17.0`; the exact patch is this project's approved pin, not a product requirement. The check
is therefore exact-version plus npm minimum, never a looser range.

## Observed on the build host (2026-11-08)

| Item | Observed | Status |
|---|---|---|
| Node 22 on `PATH` (`/opt/node22/bin/node`) | v22.23.4, npm 10.9.9 | PASS (family 22, meets `>= 22.22.0`; the Cursor Dockerfile pins 22.23.3) |
| Node 24 selected (`$HOME/.cache/qa-portfolio/toolchains/node/24.22.0/bin/node`) | v24.22.0, npm 11.19.1 | PASS (provisioned by `--toolchain-only`, checksum verified; reused on the second run) |
| Legacy `/opt/node24/bin/node` | v24.22.1, npm 11.19.1 | Not selected; sha256 unchanged before and after the runs |
| Official Node 24.22.0 archive | downloaded and SHA-256 matched against its published entry | PASS (inside the setup run) |
| `curl`, `tar`, `xz`, `sha256sum`, `mv`, `mktemp` | present | PASS |
| `claude --version` | 2.1.319 | PASS (`>= 2.1.281` for `sessionUrl: false`) |
| Docker (`docker info`) | not reachable on this host | ENV for product lanes only; not an F0-1 prerequisite |

## Setup commands

```bash
bash scripts/cloud-install.sh --toolchain-only
```

Product-free: provisions and verifies the two runtimes, exports nothing outside its own process, starts no
product and clones nothing. Exits 0 on success.

```bash
bash scripts/cloud-install.sh
```

Full setup (later, after F0-2 and owner selection): toolchains, `npm ci`, then the four-product bootstrap
with explicit names. Not run in F0-1.

Repository commands must run on the Node 22 that the contract selects. This handoff reads the absolute
`NODE22` that `--toolchain-only` reports, then puts its directory first on `PATH`. It works from any starting
`PATH`, including one with no Node 22, and with a `QA_TOOLCHAIN_ROOT` that contains spaces:

```bash
# Handoff: on any failure, return (when sourced) or exit (when run as a file) BEFORE anything is exported
# or PATH is changed. Paste into a shell, or source the block; do not run it as a subshell.
NODE22_LOG="$(bash scripts/cloud-install.sh --toolchain-only 2>&1)" \
  || { printf '%s\n' "$NODE22_LOG" >&2; echo "NODE22 handoff: installer failed; nothing exported" >&2; return 1 2>/dev/null || exit 1; }
NODE22_CANDIDATE="$(printf '%s\n' "$NODE22_LOG" | sed -n 's/^\[cloud-install\] NODE22=\(.*\) (v[^)]*)$/\1/p')"
NODE22_VERSION="$([ -x "$NODE22_CANDIDATE" ] && "$NODE22_CANDIDATE" -p 'process.versions.node' 2>/dev/null || true)"
if [ -z "$NODE22_CANDIDATE" ] || [ "${NODE22_CANDIDATE#/}" = "$NODE22_CANDIDATE" ] || [ ! -x "$NODE22_CANDIDATE" ] \
  || [ "${NODE22_VERSION%%.*}" != "22" ] \
  || [ "$(printf '%s\n' 22.22.0 "$NODE22_VERSION" | sort -V | head -n 1)" != "22.22.0" ]; then
  echo "NODE22 handoff: invalid NODE22 (${NODE22_CANDIDATE:-empty}); nothing exported" >&2
  return 1 2>/dev/null || exit 1
fi
NODE22="$NODE22_CANDIDATE"
export NODE22
export PATH="$(dirname "$NODE22"):$PATH"
```

Then the repository commands, on the selected Node 22:

```bash
npm ci
npm run check:static
npm run unit
```

- **Existing installation:** a compatible Node 22 already on `PATH` is selected as is (for example
  `/opt/node22/bin/node`, v22.23.4). Nothing is downloaded.
- **Fallback:** with no compatible Node 22 on `PATH`, Node 22.23.3 is provisioned side by side under
  `QA_TOOLCHAIN_ROOT`, verified against its published SHA-256, and reused on later runs.
- **Configurable root:** `QA_TOOLCHAIN_ROOT` must be an absolute path. Every expansion above is quoted, so
  paths containing spaces work.
- **Cloud sessions:** the SessionStart hook exports the same `NODE22` and `PATH` into `CLAUDE_ENV_FILE`
  after setup. Sourcing that file gives the same handoff without running setup again. The hook never
  provisions anything.
- **Failure:** a relative `QA_TOOLCHAIN_ROOT` prints `ERROR` and selects nothing. If `NODE22` is empty,
  do not run the repository commands.

## SessionStart hook (`.claude/hooks/session-start.sh`)

- **Outside a Claude Code cloud session** (`CLAUDE_CODE_REMOTE` is not `true`): it skips with exit 0 and
  writes nothing.
- **In a cloud session:** it validates everything first (Node 22 on `PATH` or the provisioned 22.23.3,
  the selected Node 24 with manifest and exact version, an absolute `PRODUCTS_ROOT` that is not inside
  `node_modules`, an existing `CLAUDE_ENV_FILE`). Only then does it write one block of shell-quoted
  exports: `PATH` (Node 22 first), `NODE22`, `NODE24`, `QA_TOOLCHAIN_ROOT`, `PRODUCTS_ROOT`. Any failed
  validation exits 1 and leaves `CLAUDE_ENV_FILE` byte-identical.
- It installs nothing, clones nothing, starts no product and does not require Docker. Docker is started by a
  separate SessionStart command, `.claude/hooks/start-docker.sh`; see [Docker](#docker).

**Lifecycle caution:** the hook only exports. It never provisions. In a cloud session where setup has not
run, the hook fails clearly; run the setup command first.

## Docker

The product lanes need a Docker daemon (live probes, and the ZAP scan later). Claude Code cloud and Cursor cloud
get Docker in different ways. This section is the reference for both.

### a. What is automatic from the repository

- **Claude Code cloud:** `.claude/settings.json` runs `.claude/hooks/start-docker.sh` as a second SessionStart command,
  beside `session-start.sh`. The two commands run in parallel and neither depends on the other. The Claude Code hooks
  docs (https://code.claude.com/docs/en/hooks) say matching hooks "run in parallel", and a non-zero exit is a
  non-blocking error. The hook starts `dockerd` when it is installed and `docker info` does not answer, waits up to
  30 seconds, and logs in to Docker Hub when both optional variables are set. It never fails the session and never
  installs Docker. Outside a Claude Code cloud session it prints a skip message and exits 0.
- **Cursor cloud:** `.cursor/Dockerfile` installs Docker Engine (its Docker block, lines 45-63), and
  `.cursor/environment.json` runs `sudo service docker start && docker info >/dev/null` as `start`. Neither takes effect
  until the owner selects these files (section c).

### b. Owner steps: Claude Code cloud

Nothing in this list is automatic. The owner pastes the setup script and the variables into the saved environment
settings by hand. A committed file does not activate them.

1. **Setup script** (paste as shown; it installs Docker Engine, then the toolchains and `npm ci`):

   ```bash
   set -euo pipefail; cd "${CLAUDE_PROJECT_DIR:?}"
   bash scripts/cloud-docker-install.sh
   bash scripts/cloud-install.sh
   ```

   Expected: both commands exit 0. `cloud-docker-install.sh` prints one of two lines, both exit 0:
   `cloud-docker-install: installed docker 28.5.2` (it installed the pin), or
   `cloud-docker-install: using preinstalled dockerd <ver> from the platform image; ...` (a `dockerd` is already
   installed, as in the Claude Code cloud image; nothing is changed). UNVERIFIED: that
   `CLAUDE_PROJECT_DIR` is set while the setup script runs. If the `cd` fails, replace `${CLAUDE_PROJECT_DIR:?}` with
   the checkout's directory name (for example `cd appsec-devsecops-pipeline`).

2. **Environment variables** (non-secret). Defaults apply; nothing to set by hand:

   - `PRODUCTS_ROOT` defaults to `$HOME/products` (`scripts/cloud-install.sh`, `.claude/hooks/session-start.sh`). An explicit value still wins.
   - `QA_TOOLCHAIN_ROOT` defaults to `$HOME/.cache/qa-portfolio/toolchains`.

   Set either only to override those defaults. An unset `HOME` with no explicit `PRODUCTS_ROOT` fails setup and the SessionStart hook with a clear error.

3. **Optional secrets** (Docker Hub pull-rate limits): `DOCKERHUB_USERNAME` (the lowercase Docker Hub account name) and
   `DOCKERHUB_TOKEN` (a read-only access token). Set both or neither. Store them only as environment secrets, never in a
   file in the repository. The hook passes the token to `docker login` on stdin and never prints it.

4. **Network: Limited**, with these allowed hosts:

   | Host | Used for |
   |---|---|
   | `github.com`, `codeload.github.com`, `raw.githubusercontent.com` | source access (as in the Claude Code section) |
   | `registry.npmjs.org` | npm dependencies |
   | `nodejs.org` | Node archives and their SHASUMS256 files |
   | `repo.yarnpkg.com` | yarn, for Cal |
   | `archive.ubuntu.com`, `security.ubuntu.com`, `ports.ubuntu.com` | apt packages (`ports` for arm64) |
   | `download.docker.com` | the Docker apt repository and its signing key |
   | `registry-1.docker.io`, `auth.docker.io`, `index.docker.io`, `production.cloudflare.docker.com` | Docker Hub image pulls and login |
   | `ghcr.io`, `pkg-containers.githubusercontent.com` | the ZAP image (GitHub Container Registry). The blob host is UNVERIFIED until the first pull |
   | `pypi.org`, `files.pythonhosted.org` | pip packages |

   Registry check (grep only; no compose file was run). The harness pin is `v0.4.0` (PR #22, merged). The grep was of the v0.4.0 tag's `docker/*.yml` (commit `31cafc0`).
   The v0.3.1 copy (the pin before #22) named the same images, except the Twenty Redis digest pin. Images found: `postgres:15` (Documenso,
   Medusa), `redis:7` (Medusa, Cal), `inbucket/inbucket`, `axllent/mailpit:v1.22.3`, `twentycrm/twenty:${TAG:-v2.44.0}`,
   `gotenberg/gotenberg:8@sha256:…`, and `redis:8.10.3@sha256:1f88291b4c57bdf249f02eb085a8669889b2d2954e91d4de5118a5da6b78dd53`
   (Twenty, `docker/twenty.compose.yml:59`, v0.4.0 only). All are Docker Hub images, so the Docker Hub row covers them.
   No quay.io, mcr.microsoft.com or other registry was found. Cal's Postgres images (verified 2026-11-10 from `Jayami123/cal` at `c2b7ac44c66f24ffef1662b276f0653988a609a3`,
   `packages/prisma/docker-compose.yml`, which the Cal adapter reads, `src/adapters/cal.adapter.ts:159-164`, `:627-629`):
   `postgres:18` for service `postgres` (line 5) and an untagged `postgres` for service `postgres_is_ready` (line 21).
   Both are Docker Hub images, so the Docker Hub row covers them. The untagged image floats to whatever `latest` is at
   pull time; it is in the product fork, not P5 code, so P5 does not change it.

5. **Verify in a NEW session** (not in the setup run). Run this command, wait about 60 seconds, and run it again:

   ```bash
   docker info --format '{{.ServerVersion}}'
   ```

   Expected both times: a non-empty version and exit 0. Sessions observed on 2026-11-10 report `29.9.2` from the
   platform image; that is the preinstalled daemon, not the 28.5.2 pin. Cursor cloud (the `.cursor/Dockerfile` build)
   reports `28.5.2`. Any empty output or exit 1 means the daemon is not running: read the `start-docker:` lines in the
   session start output and `/tmp/dockerd.log`. Every lane evidence file must record the server version it ran on.

### c. Owner steps: Cursor cloud

Nothing to paste as a setup script. The Cursor install step stays `bash scripts/cloud-install.sh`; Docker comes from the
Dockerfile.

1. In the Cursor cloud-agent environment settings, select this repository's `.cursor/environment.json` and
   `.cursor/Dockerfile`. Build from the default branch.
2. Non-secret variables: nothing to set by hand.

   - `PRODUCTS_ROOT` defaults to `$HOME/products`. On this Dockerfile that is `/home/ubuntu/products` (`USER ubuntu`, `WORKDIR /home/ubuntu`).
   - `QA_TOOLCHAIN_ROOT` is already `ENV QA_TOOLCHAIN_ROOT=/opt/qa-portfolio/toolchains` in `.cursor/Dockerfile`.

   Set either only to override those defaults.

3. Optional: the same `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets as in section b.
4. If egress is restricted, allow the hosts in the table in section b.
5. Verify in a NEW agent: run `docker info --format '{{.ServerVersion}}'` twice, about 60 seconds apart. Expected both
   times: `28.5.2`.

Status: the Dockerfile build is **UNPROBED**. It was not run in this build.

## Schemathesis (shared hashed lock)

The pin is `requirements/schemathesis.in` (`schemathesis==4.33.1`) and the fully hashed lock is `requirements/schemathesis.txt`, generated with uv 0.13.7 (`uv pip compile requirements/schemathesis.in --universal --python-version 3.11 --generate-hashes --output-file requirements/schemathesis.txt`). Install only into a virtual environment: `python3 -m venv <venv> && <venv>/bin/pip install --require-hashes -r requirements/schemathesis.txt`. Needs Python >= 3.11 and `python3 -m venv`, and the hosts `pypi.org` and `files.pythonhosted.org` (already in the allowed-hosts table). The lane builds never pin Schemathesis anywhere else, and never in `package.json`.

## PRODUCTS_ROOT (one value for bootstrap and the harness)

The harness reads `PRODUCTS_ROOT` only from the process environment and resolves an unset or relative value against the current directory (harness v0.4.0 `src/config.ts:11`, `:37-48`). So: always export an absolute `PRODUCTS_ROOT` before bootstrap and harness commands. Cloud setup (`scripts/cloud-install.sh`) and the SessionStart hook (`.claude/hooks/session-start.sh`) default to `$HOME/products` when `PRODUCTS_ROOT` is unset; an explicit `PRODUCTS_ROOT` still wins; an unset `HOME` with no `PRODUCTS_ROOT` fails with a clear error. That default is writable on both clouds: Claude Code cloud uses the cloud user's `HOME`, and Cursor cloud uses `/home/ubuntu` (`.cursor/Dockerfile` `USER ubuntu`). Locally, run `bash scripts/bootstrap.sh --print-products-root` to see the path bootstrap will use; when the value came from `.env` or the default, bootstrap prints the exact `export PRODUCTS_ROOT=...` line. Bootstrap's own default is `../products` next to this repository; a relative value or an unwritable default fails instead of falling back to `$HOME/products`. In CI, every lane job that clones or calls the harness sets it for the whole job, first step: `echo "PRODUCTS_ROOT=$RUNNER_TEMP/products" >> "$GITHUB_ENV"` (enforced by `tests/unit/ci/workflow.test.ts`).

## Claude Code

### A. NOW (this F0-1 build): lean planning and code environment

- Use the existing lean environment with normal source access. No saved setup script, no product
  credentials, no product services.
- Owner check (product-free): `bash scripts/cloud-install.sh --toolchain-only`.
- Status: `npm ci`, `check:static`, `unit` **PASS** on this build (9 tests). `--toolchain-only`
  **PASS** with the contract. Hook in a real cloud session **UNPROBED**; the hook is **SIMULATED**
  locally (fake runtimes, sourced in a child shell).

### B. AFTER F0-1 MERGES

- Committed files exist on `main`. Full provider activation is **not** certified by syntax or unit checks.
- Owner-selected product-free setup command, if chosen: `bash scripts/cloud-install.sh --toolchain-only`.
  Automatic: nothing else. The default full setup is not activated.
- Owner-only, manual: none required for this step. Do not set `PRODUCTS_ROOT` yet.
- **Caution:** `.claude/settings.json` runs the hook in every session of this repository. A cloud session
  without a provisioned Node 24 at the contract path fails the hook with a clear message.

### C. AFTER F0-2 and BEFORE THE FIRST LANE

- Saved setup command (owner selects it): `bash scripts/cloud-install.sh`. The script defaults
  `PRODUCTS_ROOT` to `$HOME/products` and provisions the runtimes before `npm ci` and the bootstrap.
- Owner-only, manual (non-secret; never a product secret): nothing. `PRODUCTS_ROOT` and
  `QA_TOOLCHAIN_ROOT` take their script defaults. Set them only to override. The same values must be used
  for setup and later sessions.
- Automatic once selected: the setup command, and the hook exports for each session.
- Network hosts: `github.com` and `raw.githubusercontent.com` (permitted source access), `codeload.github.com`
  and `registry.npmjs.org` (dependencies; see the lock notes), `nodejs.org` (official archives and their
  SHASUMS256 files). Docker and image hosts only when product preparation is authorized.

## Cursor

Cursor stays on its existing lean selection until the owner selects this repository's committed files.

### A. NOW

- Keep the existing lean selection. Do not select the committed `.cursor/environment.json` or
  `.cursor/Dockerfile`.

### B. AFTER F0-1 MERGES

- `.cursor/environment.json` is adapted (not verbatim P2): `install` runs `bash scripts/cloud-install.sh`
  (full mode; not selected until F0-2) and `start` runs `sudo service docker start && docker info >/dev/null`.
  The receiver-hostname and `qa:passwords` calls are removed.
- `.cursor/Dockerfile` installs Node 22.23.3 to `/usr/local` and Node 24.22.0 side by side under
  `/opt/qa-portfolio/toolchains/node/24.22.0`, each archive verified against its SHASUMS256 before
  extraction, with a manifest. It does not use `/opt/node24`. The image is **UNPROBED**: no Docker daemon
  was available here, so the build was not run.
- Automatic: nothing until the owner selects the file and Dockerfile in the saved settings.

### C. AFTER F0-2 and BEFORE THE FIRST LANE

- Owner selects this repository's environment file and Dockerfile in the saved Cursor settings. Install and
  start run automatically only once that selection is active; a committed file does not activate itself.
- Owner-only, manual: nothing. `PRODUCTS_ROOT` defaults to `$HOME/products` (`/home/ubuntu/products` on
  this Dockerfile). `QA_TOOLCHAIN_ROOT` is already set in `.cursor/Dockerfile`. Set them only to override.
- The same network hosts as the Claude Code section apply.

## Lockfile and transport evidence (`qa-portfolio-harness`)

- The lock records the harness as `git+ssh://git@github.com/Jayami123/qa-portfolio-harness.git#31cafc0844d441a8567db89cd18612300c3d4b77` (tag `v0.4.0`; the v0.3.1 pin recorded `7d4a3ae`).
- A fresh scratch `npm ci` (npm 10.9.9, empty npm cache, inherited sandbox CA and proxy variables kept,
  injected Git rewrites removed with `GIT_CONFIG_COUNT=0`, `GIT_CONFIG_GLOBAL=/dev/null`,
  `GIT_CONFIG_NOSYSTEM=1`, and SSH forced to fail with `GIT_SSH=/bin/false`) **exited 0** and installed the
  harness at version 0.4.0. Checked 2026-11-10 on the v0.4.0 lock.
- A logging `git` wrapper on `PATH` recorded the invocations: `git ls-remote https://github.com/Jayami123/qa-portfolio-harness.git`
  and `git clone https://github.com/Jayami123/qa-portfolio-harness.git`, both over HTTPS. Zero SSH invocations. The anonymous
  codeload tarball returned HTTP 403, so the Git fallback supplied the bytes.
- Conclusion for this environment: the `git+ssh` spelling was fetched over HTTPS with SSH disabled. **SSH was
  not required here.** This bump changes only the harness entry's spec, version and commit; the transport spelling is the lock's own. The sandbox's
  injected `url.https://github.com/.insteadOf` rewrites were disabled for this test, so the result does not
  depend on them.

## npm audit (dev-only; not fixed)

- `npm audit` reports 10 moderate findings, all reaching one advisory: **GHSA-g3hv-75wg-m249**
  (`minimatch` denial of service via globparts amplification; affected range `>=7.0.0 <11.0.1`).
- Installed `minimatch` is 10.2.6, reached only through `eslint@10.12.0` and `typescript-eslint@8.71.2`
  (both devDependencies). It is absent from the production tree (`npm ls --omit=dev`).
- npm's suggested fix is a semver-major change to `eslint 9.39.5` / `typescript-eslint 8.36.0`. Applying it
  would break the pins, so it is not applied. No risk acceptance is recorded: the finding is open, dev-only,
  and unfixed until a pin change is approved.

## Explicitly UNPROBED or deferred

- Hook behaviour in a real hosted Claude Code session (SIMULATED only here).
- Cursor build of `.cursor/Dockerfile` (no Docker daemon on this host).
- Full setup, product bootstrap, product start or stop: not run in F0-1.
- Attribution footer on a real pull request: not run; no PR was created.
- Attached multiple repositories' hook ordering: not verified.
