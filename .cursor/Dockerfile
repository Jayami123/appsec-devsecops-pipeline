# Vendored from Jayami123/api-webhook-db-test-suite ref 99a2fde .cursor/Dockerfile. Change here only with a reason in the PR.
# Base image for Cursor Cloud Agents on this repo (referenced by .cursor/environment.json).
# Docker block follows https://cursor.com/docs/cloud-agent/setup ("Running Docker").
# Do not COPY the project: Cursor clones the repo and runs `install` itself.
# P5 lane foundation PR: python3 and python3-venv for the hashed Schemathesis lock (requirements/schemathesis.txt).
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git gnupg openssl python3 python3-venv sudo xz-utils poppler-utils \
    && rm -rf /var/lib/apt/lists/*
# Node.js 22 (harness and Medusa need >= 22.22.0) on PATH, and pnpm 10.11.1 (the Medusa fork's pin).
# Every archive is verified against its published SHASUMS256 entry before extraction.
ARG NODE_VERSION=22.23.3
# Node.js 24 for Documenso only (fork engines node >= 24, npm >= 11.17). Side by side under the
# selection contract root (never /opt/node24). Exact pin 24.22.0; NODE24 is the selected path.
ARG NODE24_VERSION=24.22.0
ENV COREPACK_HOME=/opt/corepack
ENV QA_TOOLCHAIN_ROOT=/opt/qa-portfolio/toolchains
ENV NODE24=/opt/qa-portfolio/toolchains/node/24.22.0/bin/node
RUN set -eu && \
    arch="$(dpkg --print-architecture)" && \
    case "$arch" in amd64) node_arch=x64 ;; arm64) node_arch=arm64 ;; *) echo "unsupported $arch"; exit 1 ;; esac && \
    work="$(mktemp -d)" && \
    base="https://nodejs.org/dist/v${NODE_VERSION}" && \
    file="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" && \
    curl --retry 3 -fsSL -o "$work/SHASUMS256.txt" "$base/SHASUMS256.txt" && \
    curl --retry 3 -fsSL -o "$work/$file" "$base/$file" && \
    expected="$(awk -v f="$file" '$2 == f { print $1 }' "$work/SHASUMS256.txt")" && \
    echo "$expected  $work/$file" | sha256sum -c - && \
    tar -xJf "$work/$file" -C /usr/local --strip-components=1 && \
    rm -rf "$work" && \
    target="$QA_TOOLCHAIN_ROOT/node/${NODE24_VERSION}" && \
    work="$(mktemp -d)" && \
    base="https://nodejs.org/dist/v${NODE24_VERSION}" && \
    file="node-v${NODE24_VERSION}-linux-${node_arch}.tar.xz" && \
    curl --retry 3 -fsSL -o "$work/SHASUMS256.txt" "$base/SHASUMS256.txt" && \
    curl --retry 3 -fsSL -o "$work/$file" "$base/$file" && \
    expected="$(awk -v f="$file" '$2 == f { print $1 }' "$work/SHASUMS256.txt")" && \
    echo "$expected  $work/$file" | sha256sum -c - && \
    mkdir -p "$target" && \
    tar -xJf "$work/$file" -C "$target" --strip-components=1 && \
    printf 'version=%s\narchive=%s\narchive_sha256=%s\nsource=%s/\n' "$NODE24_VERSION" "$file" "$expected" "$base" > "$target/.qa-toolchain-manifest" && \
    rm -rf "$work" && \
    mkdir -p "$COREPACK_HOME" && corepack enable && corepack prepare pnpm@10.11.1 --activate && \
    chmod -R a+rwX "$COREPACK_HOME" && node --version && pnpm --version && "$NODE24" --version
# Docker (Cursor's recommended setup for Docker inside Cloud Agents).
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y \
    docker-ce=5:28.5.2-1~ubuntu.24.04~noble \
    docker-ce-cli=5:28.5.2-1~ubuntu.24.04~noble \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y fuse-overlayfs && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /etc/docker && printf '%s\n' '{' '  "storage-driver": "fuse-overlayfs"' '}' > /etc/docker/daemon.json
RUN apt-get update && apt-get install -y iptables && rm -rf /var/lib/apt/lists/*
RUN update-alternatives --set iptables /usr/sbin/iptables-legacy && \
    update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy
# Non-root user with docker group and passwordless sudo (as in Cursor's example).
RUN id -u ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu
RUN groupadd -f docker && usermod -aG docker ubuntu && usermod -aG sudo ubuntu && \
    echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu && chmod 0440 /etc/sudoers.d/ubuntu
USER ubuntu
WORKDIR /home/ubuntu
