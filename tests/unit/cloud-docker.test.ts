// Docker foundation regressions for Claude Code cloud sessions: the SessionStart hook start-docker.sh and the
// setup-script installer cloud-docker-install.sh. Fake binaries on a temp PATH: no real Docker, no network,
// no sudo. Kept separate from foundation.test.ts.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const repoPath = (relative: string): string =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url));
const readRepo = (relative: string): string => readFileSync(repoPath(relative), "utf8");
const codeLines = (text: string): string[] =>
  text.split("\n").filter((line) => !/^\s*#/.test(line));
const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const HOOK = repoPath(".claude/hooks/start-docker.sh");
const INSTALL = repoPath("scripts/cloud-docker-install.sh");
const PIN_PKG = "5:28.5.2-1~ubuntu.24.04~noble";

const scratch = mkdtempSync(join(tmpdir(), "p5-cloud-docker-"));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

// Only the utilities the scripts need. /usr/bin is not on the test PATH, so the host's real docker or
// dockerd can never be found by accident; each test adds its own fakes in front.
const TOOLS_DIR = join(scratch, "tools");
mkdirSync(TOOLS_DIR);
for (const tool of [
  "id",
  "sleep",
  "tr",
  "touch",
  "dpkg",
  "sed",
  "awk",
  "cmp",
  "mktemp",
  "rm",
  "cat",
]) {
  for (const dir of ["/usr/bin", "/bin"]) {
    if (existsSync(join(dir, tool))) {
      symlinkSync(join(dir, tool), join(TOOLS_DIR, tool));
      break;
    }
  }
}

let binCount = 0;
// A fresh directory for one test's fake commands.
function binDir(label: string): string {
  binCount += 1;
  const dir = join(scratch, `bin-${binCount}-${label}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Writes an executable /bin/sh script at <dir>/<name>.
function fakeCommand(dir: string, name: string, body: string): void {
  const file = join(dir, name);
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
}

function runScript(
  script: string,
  env: Record<string, string>,
  args: string[] = [],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("/bin/bash", [script, ...args], { env, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// Environment for the hook: cloud mode, the test PATH, no real sudo, and a log file inside scratch.
function hookEnv(bin: string, extra: Record<string, string>): Record<string, string> {
  return {
    PATH: `${bin}:${TOOLS_DIR}`,
    HOME: scratch,
    CLAUDE_CODE_REMOTE: "true",
    START_DOCKER_SUDO: "",
    START_DOCKER_LOG: join(scratch, "dockerd.log"),
    ...extra,
  };
}

const NOBLE_OS = join(scratch, "os-release-noble");
writeFileSync(NOBLE_OS, 'ID=ubuntu\nVERSION_ID="24.04"\nVERSION_CODENAME=noble\n');

test("start-docker skips outside a Claude Code cloud session and exits 0", () => {
  const result = runScript(HOOK, { PATH: TOOLS_DIR, HOME: scratch });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "start-docker: skipped (not a Claude Code cloud session)\n");
  assert.equal(result.stdout, "");
});

test("start-docker does nothing when docker already answers", () => {
  const bin = binDir("answers");
  const calls = join(bin, "dockerd-calls");
  fakeCommand(bin, "docker", "exit 0");
  fakeCommand(bin, "dockerd", `echo called >> "${calls}"`);
  const result = runScript(HOOK, hookEnv(bin, {}));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "start-docker: docker already running\n");
  assert.equal(existsSync(calls), false, "dockerd must not be started");
});

test("start-docker starts dockerd with setsid when docker does not answer", () => {
  const bin = binDir("setsid");
  const marker = join(bin, "docker-is-up");
  const argv = join(bin, "setsid-argv");
  const dockerdCalls = join(bin, "dockerd-calls");
  // docker answers only after setsid has run (the marker), so the first probe fails and the poll succeeds.
  fakeCommand(bin, "docker", `[ -f "${marker}" ] && exit 0; exit 1`);
  fakeCommand(bin, "dockerd", `echo called >> "${dockerdCalls}"`);
  fakeCommand(bin, "setsid", `printf '%s\\n' "$@" > "${argv}"; touch "${marker}"`);
  const result = runScript(HOOK, hookEnv(bin, { DOCKER_START_TIMEOUT_S: "3" }));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(argv, "utf8").split("\n").filter(Boolean), ["-f", "dockerd"]);
  assert.equal(existsSync(dockerdCalls), false, "setsid runs dockerd, not the hook");
  assert.doesNotMatch(result.stderr, /WARNING/);
});

test("start-docker warns and still exits 0 when dockerd is missing", () => {
  const bin = binDir("no-dockerd");
  fakeCommand(bin, "docker", "exit 1");
  const result = runScript(HOOK, hookEnv(bin, { DOCKER_START_TIMEOUT_S: "1" }));
  assert.equal(result.status, 0);
  assert.match(
    result.stderr,
    /start-docker: WARNING dockerd not installed; run scripts\/cloud-docker-install\.sh in the environment setup script/,
  );
  assert.match(result.stderr, /start-docker: WARNING Docker is not available/);
});

test("start-docker warns and still exits 0 when docker never answers", () => {
  const bin = binDir("never-answers");
  fakeCommand(bin, "docker", "exit 1");
  fakeCommand(bin, "dockerd", "exit 0");
  fakeCommand(bin, "setsid", "exit 0");
  const result = runScript(HOOK, hookEnv(bin, { DOCKER_START_TIMEOUT_S: "1" }));
  assert.equal(result.status, 0);
  assert.match(
    result.stderr,
    /start-docker: WARNING Docker is not available \(see .*dockerd\.log\)/,
  );
});

test("start-docker never prints the Docker Hub token", () => {
  const bin = binDir("token");
  const token = "dckr_pat_TESTONLY_0123456789abcdef";
  const received = join(bin, "login-stdin");
  fakeCommand(
    bin,
    "docker",
    `case "$1" in info) exit 1 ;; login) read -r t; printf '%s' "$t" > "${received}"; exit 0 ;; esac; exit 1`,
  );
  const result = runScript(
    HOOK,
    hookEnv(bin, {
      DOCKER_START_TIMEOUT_S: "1",
      DOCKERHUB_USERNAME: "exampleuser",
      DOCKERHUB_TOKEN: token,
    }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /start-docker: docker login ok/);
  assert.equal(readFileSync(received, "utf8"), token, "the token reaches docker on stdin");
  assert.equal(result.stdout.includes(token), false, "token absent from stdout");
  assert.equal(result.stderr.includes(token), false, "token absent from stderr");
});

test("start-docker refuses an uppercase DOCKERHUB_USERNAME by name", () => {
  const bin = binDir("uppercase");
  const loginCalled = join(bin, "login-called");
  fakeCommand(bin, "docker", `[ "$1" = login ] && touch "${loginCalled}"; exit 1`);
  const result = runScript(
    HOOK,
    hookEnv(bin, {
      DOCKER_START_TIMEOUT_S: "1",
      DOCKERHUB_USERNAME: "ExampleUser",
      DOCKERHUB_TOKEN: "dckr_pat_TESTONLY_0123456789abcdef",
    }),
  );
  assert.equal(result.status, 0);
  assert.match(result.stderr, /DOCKERHUB_USERNAME has an uppercase letter/);
  assert.equal(result.stderr.includes("ExampleUser"), false, "the username value is not printed");
  assert.equal(existsSync(loginCalled), false, "no login is attempted");
});

test("settings.json runs session-start.sh and start-docker.sh at SessionStart", () => {
  const settings = JSON.parse(readRepo(".claude/settings.json")) as {
    hooks: { SessionStart: { hooks: { type: string; command: string }[] }[] };
    attribution: unknown;
  };
  const entries = settings.hooks.SessionStart.flatMap((group) => group.hooks);
  assert.deepEqual(
    entries.map((entry) => entry.type),
    ["command", "command"],
  );
  assert.deepEqual(
    entries.map((entry) => entry.command),
    [
      'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh"',
      'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/start-docker.sh"',
    ],
  );
  assert.deepEqual(settings.attribution, { commit: "", pr: "", sessionUrl: false });
});

test("session-start.sh is unchanged and still never starts Docker", () => {
  const text = readRepo(".claude/hooks/session-start.sh");
  assert.match(
    text.split("\n")[2] ?? "",
    /It never installs, repairs, downloads, clones, or starts a product or Docker\./,
  );
  assert.deepEqual(
    codeLines(text).filter((line) => line.includes("dockerd")),
    [],
    "no code line in session-start.sh may start dockerd",
  );
});

test("cloud-docker-install pins the same Docker packages as the Cursor Dockerfile", () => {
  const dockerfile = readRepo(".cursor/Dockerfile");
  const script = readRepo("scripts/cloud-docker-install.sh");

  const dockerfilePins = [...dockerfile.matchAll(/(docker-ce(?:-cli)?)=(\S+)/g)].map(
    (match) => `${match[1] ?? ""}=${match[2] ?? ""}`,
  );
  assert.deepEqual(dockerfilePins, [`docker-ce=${PIN_PKG}`, `docker-ce-cli=${PIN_PKG}`]);

  const scriptVersion = script.match(/^DOCKER_PKG_VERSION="([^"]+)"$/m)?.[1];
  assert.equal(scriptVersion, PIN_PKG, "script pin equals the Dockerfile pin");
  assert.match(script, /"docker-ce=\$DOCKER_PKG_VERSION"/);
  assert.match(script, /"docker-ce-cli=\$DOCKER_PKG_VERSION"/);

  for (const name of [
    "containerd.io",
    "docker-buildx-plugin",
    "docker-compose-plugin",
    "fuse-overlayfs",
    "iptables",
  ]) {
    assert.match(dockerfile, new RegExp(`(^|\\s)${escapeRe(name)}(\\s|\\\\|$)`, "m"), name);
    assert.match(script, new RegExp(`^  ${escapeRe(name)}$`, "m"), `script installs ${name}`);
  }

  for (const text of [dockerfile, script]) {
    assert.match(text, /"storage-driver": "fuse-overlayfs"/);
    assert.match(text, /iptables-legacy/);
  }
});

test("cloud-docker-install --dry-run changes nothing and prints the pinned apt install", () => {
  const bin = binDir("dry-run");
  const calls = join(bin, "state-changing-calls");
  for (const name of ["apt-get", "curl", "gpg", "update-alternatives", "install", "tee"]) {
    fakeCommand(bin, name, `echo ${name} >> "${calls}"; exit 1`);
  }
  const result = runScript(
    INSTALL,
    {
      PATH: `${bin}:${TOOLS_DIR}`,
      HOME: scratch,
      START_DOCKER_SUDO: "",
      OS_RELEASE_FILE: NOBLE_OS,
    },
    ["--dry-run"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /dry-run: no change will be made/);
  assert.match(
    result.stdout,
    new RegExp(
      `apt-get install -y docker-ce=${escapeRe(PIN_PKG)} docker-ce-cli=${escapeRe(PIN_PKG)} containerd\\.io docker-buildx-plugin docker-compose-plugin fuse-overlayfs iptables`,
    ),
  );
  assert.equal(
    existsSync(calls),
    false,
    "dry-run runs no apt, key, alternatives or file-install command",
  );
});

test("cloud-docker-install refuses a non-noble OS, and accepts noble as its control", () => {
  const bin = binDir("os-check");
  const calls = join(bin, "state-changing-calls");
  for (const name of ["apt-get", "curl", "gpg", "update-alternatives", "install", "tee"]) {
    fakeCommand(bin, name, `echo ${name} >> "${calls}"; exit 1`);
  }
  const jammy = join(scratch, "os-release-jammy");
  writeFileSync(jammy, 'ID=ubuntu\nVERSION_ID="22.04"\nVERSION_CODENAME=jammy\n');
  const base = { PATH: `${bin}:${TOOLS_DIR}`, HOME: scratch, START_DOCKER_SUDO: "" };

  const refused = runScript(INSTALL, { ...base, OS_RELEASE_FILE: jammy });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /cloud-docker-install: ERROR supports Ubuntu 24\.04 \(noble\) only/);
  assert.equal(existsSync(calls), false, "no command runs on a refused OS");

  const control = runScript(INSTALL, { ...base, OS_RELEASE_FILE: NOBLE_OS }, ["--dry-run"]);
  assert.equal(control.status, 0, control.stderr);
});
