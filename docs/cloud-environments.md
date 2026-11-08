# Cloud environments: owner handoff (F0-1)

This page lists the manual steps the repository owner performs for the two cloud providers. The
builder does not select, save or activate any environment. Nothing here is a claim that a provider
ran a committed command unless the status line says PASS.

Status keys: **PASS** = observed by a real run in this build. **UNPROBED** = not observed.
**ENV** = observed blocker, with the sanitized cause.

## Observed on the build host (2026-11-08)

| Item | Observed | Required | Status |
|---|---|---|---|
| Node 22 (`/opt/node22/bin/node`) | v22.23.4, npm 10.9.9 | family 22, `>=22.22.0` | PASS (Cursor Dockerfile pins 22.23.3; host is a later 22.x patch) |
| Node 24 (`/opt/node24/bin/node`) | **v24.22.1**, npm 11.19.1 | exactly v24.22.0 | **ENV**: unexpected installation at the approved path; not overwritten |
| Official Node 24.22.0 archive | downloaded to scratch, SHA-256 matches its published SHASUMS256 entry; bundled npm 11.19.1 | checksum-verified | PASS (provisioning path verified without touching `/opt`) |
| `curl`, `tar`, `xz`, `sha256sum` | present | required by setup | PASS |
| `claude --version` | 2.1.319 | `>= 2.1.281` for `sessionUrl: false` | PASS |
| `docker info` | failed (daemon not reachable) | later product-lane prerequisite | ENV for product lanes; not an F0-1 prerequisite |

The Node 24 row is a conflict, not a success. `scripts/cloud-install.sh` refuses to replace it and
exits 1 with a clear message. The owner decides whether to replace that installation or to change
the approved pin. Until then, every full setup and Documenso step stops here.

## Claude Code

### A. NOW (this F0-1 build): lean planning and code environment

- Use the lean environment that already works for planning and code: normal source access, bash,
  git, curl, checksum and tar tools, and a Node 22 runtime for `npm`.
- No product credentials, no product services, no saved setup script. Do not select a saved
  environment that runs scripts which do not yet exist on `main`.
- Repository install and checks, Node 22 only (run after this branch's files exist):

```bash
export PATH=/opt/node22/bin:$PATH
npm ci
npm run check:static
npm run unit
```

- Product-free runtime check (after this branch's files exist). Expected today: exits 1 with the
  Node 24 ENV conflict above:

```bash
bash scripts/cloud-install.sh --toolchain-only
```

- Status: `npm ci`, `check:static`, `unit` **PASS** on this build (2 unit tests). `--toolchain-only`
  **ENV** (Node 24 conflict). SessionStart hook **ENV** on this host for the same Node 24 reason;
  hook behaviour in a fresh session **UNPROBED**.

### B. AFTER F0-1 MERGES: scripts and configuration exist on `main`

- The committed files are present, but the full provider setup, the saved-environment hook order and
  the fresh-session hook are **not certified** by syntax or unit checks. Keep the lean environment for
  F0-2.
- An owner-selected product-free setup command is permitted after merge:

```bash
bash scripts/cloud-install.sh --toolchain-only
```

  This mode has no F0-2 dependency and does not activate the default full bootstrap.
- Repository install (separate Node 22 command):

```bash
export PATH=/opt/node22/bin:$PATH
npm ci
```

- The committed `.claude/settings.json` runs `.claude/hooks/session-start.sh` in **every session of
  this repository**. Until the Node 24 conflict is resolved, that hook exits 1 with a clear message.
  Owner decision required before merge: accept the conflict as ENV or change the approved pin.
- Status: fresh-session hook **UNPROBED**; Docker availability in a fresh session **UNPROBED**.
- Full provider activation (`bash scripts/cloud-install.sh` as the saved setup command) is
  **deferred until after F0-2**, when the dependency closure and setup review are done. Do not
  activate it before then.

### C. AFTER F0-2 and BEFORE THE FIRST LANE: owner review and selection

- Saved setup command: `bash scripts/cloud-install.sh`. The script sets its own defaults for
  `PRODUCTS_ROOT` and provisions Node 22 and Node 24 before `npm ci` and the four-product bootstrap.
- Owner-only manual selection and variables (never automatic):
  - Select this repository's saved environment and paste the setup command above.
  - Set the non-secret variable for later sessions:

```bash
PRODUCTS_ROOT=/home/user/products
```

  - Do not enter any product secret, token or password here. Credentials, if ever needed, go
    through a separate secure credential path.
- Automatically executed by the provider once selected: the setup command and the SessionStart hook.
  The hook exports `NODE22`, `NODE24`, `PRODUCTS_ROOT` and a Node 22-first `PATH` through
  `CLAUDE_ENV_FILE`. It starts no product.
- Network hosts needed: `github.com` and `raw.githubusercontent.com` (permitted source access only),
  `registry.npmjs.org`, `nodejs.org` (official archives and their SHASUMS256 files). Package-manager,
  Docker and image hosts are added only when full product preparation is authorized. A blocked host
  stops the setup; there is no workaround.

## Cursor

Cursor cloud is kept on the existing lean selection until the owner activates the committed
configuration.

### A. NOW

- Keep the existing lean selection. Do not select this repository's committed `.cursor/environment.json`
  or `.cursor/Dockerfile` yet.
- No product credentials. No product services.

### B. AFTER F0-1 MERGES

- The committed `.cursor/environment.json` is an adapted file (not verbatim P2):
  - `install`: `bash scripts/cloud-install.sh` (full mode). Do not select it until F0-2 (see C).
  - `start`: `sudo service docker start && docker info >/dev/null`. The P2 receiver-hostname call and
    the `qa:passwords` call are removed.
- The committed `.cursor/Dockerfile` (verbatim P2 base, Node 22.23.3, Node 24.22.0 at `/opt/node24`,
  pnpm 10.11.1, Docker) is not selected by merging.
- Status: Cursor selection **UNPROBED**; the install and start commands **UNPROBED**; Docker start
  **ENV** on this host (`docker info` failed).

### C. AFTER F0-2 and BEFORE THE FIRST LANE

- The owner selects this repository's committed environment file and Dockerfile in the saved Cursor
  environment settings. Install and start run automatically only once that selection is active. A
  committed file does not activate itself.
- Verify the writable product root on the actual Cursor host, then pass the same explicit value to
  setup and later sessions:

```bash
PRODUCTS_ROOT=/home/user/products
```

  (Replace the path with the verified writable location on that host.)
- The same network hosts as the Claude Code section apply.

## Adaptations and deliberate call-site choices (F0-1)

- `scripts/cloud-install.sh` is new. It has a `--toolchain-only` diagnostic mode that provisions and
  verifies the toolchains and then exits before `npm ci` and bootstrap. Full mode is the default and
  is unchanged in intent.
- Full mode calls bootstrap with all four product names explicitly (`medusa twenty documenso cal`).
  The P2 bootstrap's no-argument default is medusa only; this is not a claim that a no-argument call
  prepares four products.
- `scripts/bootstrap.sh` (adapted from P2 at `99a2fde`):
  - The Cal `.env` writer `prepare_cal_env` and its call are removed. Fork `.env` provisioning is
    harness-owned.
  - A pin mismatch on an existing checkout is a hard error (P2 only warned). Nothing is reset.
  - Documenso checks an absolute `NODE24`, exact v24.22.0, and an npm of at least 11.17.0 before any
    install.
  - The fallback that wrote `PRODUCTS_ROOT` into a repository `.env` is removed.
- `.claude/hooks/session-start.sh` is new: post-setup only, no install and no product start. Docker is
  reported, not required, in F0-1.
- `.cursor/environment.json` is adapted (start command), as above.

## Explicitly UNPROBED or deferred

- Fresh-session SessionStart hook behaviour and its exports.
- The `sessionUrl: false` footer suppression on a real pull request: not run, because this task
  creates no pull request.
- Full provider activation of the setup command and the Cursor selection: deferred until after F0-2.
- Attached multiple repositories' hook ordering: not verified.
