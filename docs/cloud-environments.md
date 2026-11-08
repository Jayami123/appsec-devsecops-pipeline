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

Repository commands use Node 22 first on `PATH`:

```bash
export PATH=/opt/node22/bin:$PATH
npm ci
npm run check:static
npm run unit
```

## SessionStart hook (`.claude/hooks/session-start.sh`)

- **Outside a Claude Code cloud session** (`CLAUDE_CODE_REMOTE` is not `true`): it skips with exit 0 and
  writes nothing.
- **In a cloud session:** it validates everything first (Node 22 on `PATH` or the provisioned 22.23.3,
  the selected Node 24 with manifest and exact version, an absolute `PRODUCTS_ROOT` that is not inside
  `node_modules`, an existing `CLAUDE_ENV_FILE`). Only then does it write one block of shell-quoted
  exports: `PATH` (Node 22 first), `NODE22`, `NODE24`, `QA_TOOLCHAIN_ROOT`, `PRODUCTS_ROOT`. Any failed
  validation exits 1 and leaves `CLAUDE_ENV_FILE` byte-identical.
- It installs nothing, clones nothing, starts no product and does not require Docker. Docker is a later
  product-lane prerequisite.

**Lifecycle caution:** the hook only exports. It never provisions. In a cloud session where setup has not
run, the hook fails clearly; run the setup command first.

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

- Saved setup command (owner selects it): `bash scripts/cloud-install.sh`. The script sets its own default
  `PRODUCTS_ROOT=/home/user/products` and provisions the runtimes before `npm ci` and the bootstrap.
- Owner-only, manual (non-secret; never a product secret):

```bash
QA_TOOLCHAIN_ROOT=/home/user/.cache/qa-portfolio/toolchains
PRODUCTS_ROOT=/home/user/products
```

  Set these only if the defaults are not wanted; otherwise the defaults apply. The same values must be used
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
- Verify the writable product root on the actual Cursor host, then pass the same explicit values to setup
  and later sessions (replace the example paths with the verified ones):

```bash
QA_TOOLCHAIN_ROOT=/opt/qa-portfolio/toolchains
PRODUCTS_ROOT=/home/user/products
```

- The same network hosts as the Claude Code section apply.

## Lockfile and transport evidence (`qa-portfolio-harness`)

- The lock records the harness as `git+ssh://git@github.com/Jayami123/qa-portfolio-harness.git#7d4a3ae36100a0150397eeac1c6fefefe5e64c15`.
- A fresh scratch `npm ci` (npm 10.9.9, empty npm cache, inherited sandbox CA and proxy variables kept,
  injected Git rewrites removed with `GIT_CONFIG_COUNT=0`, `GIT_CONFIG_GLOBAL=/dev/null`,
  `GIT_CONFIG_NOSYSTEM=1`, and SSH forced to fail with `GIT_SSH=/bin/false`) **exited 0** and installed the
  harness at version 0.3.1.
- The Git trace shows npm fetching the harness with `git clone https://github.com/Jayami123/qa-portfolio-harness.git`
  over HTTPS. No SSH process ran. The anonymous codeload tarball returned HTTP 403, so the Git fallback supplied the
  bytes.
- Conclusion for this environment: the `git+ssh` spelling was fetched over HTTPS with SSH disabled. **SSH was
  not required here.** The lock is preserved byte-identical; the transport is not changed. The sandbox's
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
