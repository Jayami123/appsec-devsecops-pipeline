#!/usr/bin/env bash
# SessionStart hook (Claude Code cloud only): start dockerd if it is installed and does not answer.
# Adapted from qa-portfolio-harness v0.4.0 .claude/hooks/session-start.sh:18-38. The Docker start is the
# setsid fix (harness CHANGELOG [0.4.0], "Cloud (Claude Code)"): dockerd runs in its own session with no
# inherited stdio, so the hook's process-group teardown does not stop it. The Docker Hub login is the
# harness lines 27-38, with the same uppercase-username refusal.
# This is a second SessionStart command beside session-start.sh. It does not depend on that hook's exports.
# It never fails the session: every path exits 0. Install the daemon with scripts/cloud-docker-install.sh.
#
# Overrides (tests and non-standard hosts only; the defaults are the production values):
#   START_DOCKER_SUDO       prefix for dockerd. Default: empty when root, else "sudo". "" means no prefix.
#   START_DOCKER_LOG        dockerd log file. Default: /tmp/dockerd.log.
#   DOCKER_START_TIMEOUT_S  seconds to wait for `docker info` after start. Default: 30.
set -u

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  printf 'start-docker: skipped (not a Claude Code cloud session)\n' >&2
  exit 0
fi

if [ -n "${START_DOCKER_SUDO+set}" ]; then
  SUDO="$START_DOCKER_SUDO"
elif [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi
LOG="${START_DOCKER_LOG:-/tmp/dockerd.log}"
timeout_s="${DOCKER_START_TIMEOUT_S:-30}"
case "$timeout_s" in '' | *[!0-9]*) timeout_s=30 ;; esac

# Idempotent: a daemon that already answers is left alone, and nothing else runs.
if docker info >/dev/null 2>&1; then
  printf 'start-docker: docker already running\n'
  exit 0
fi

if command -v dockerd >/dev/null 2>&1; then
  # Own session (setsid -f) and no inherited stdio: the hook's process-group teardown does not stop dockerd.
  # shellcheck disable=SC2086  # SUDO is intentionally unquoted: an empty value adds no prefix.
  $SUDO setsid -f dockerd >"$LOG" 2>&1 </dev/null
  i=0
  until docker info >/dev/null 2>&1 || [ "$i" -ge "$timeout_s" ]; do
    sleep 1
    i=$((i + 1))
  done
else
  printf 'start-docker: WARNING dockerd not installed; run scripts/cloud-docker-install.sh in the environment setup script\n' >&2
fi

if ! docker info >/dev/null 2>&1; then
  printf 'start-docker: WARNING Docker is not available (see %s); product stacks will not start.\n' "$LOG" >&2
fi

# Docker Hub login, only when both variables are set. The token goes to docker on stdin and is never printed.
# Docker Hub account names are lowercase. An uppercase letter makes docker send a malformed Authorization
# header, so the hook names the variable (never its value) and skips the login.
if [ -n "${DOCKERHUB_USERNAME:-}" ] && [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  if [ "$DOCKERHUB_USERNAME" != "$(printf '%s' "$DOCKERHUB_USERNAME" | tr 'A-Z' 'a-z')" ]; then
    printf 'start-docker: ERROR DOCKERHUB_USERNAME has an uppercase letter; set the lowercase Docker Hub name. Docker login skipped.\n' >&2
  elif printf '%s' "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin >/dev/null 2>&1; then
    printf 'start-docker: docker login ok\n'
  else
    printf 'start-docker: ERROR docker login failed (check DOCKERHUB_USERNAME and DOCKERHUB_TOKEN; values not printed)\n' >&2
  fi
fi

exit 0
