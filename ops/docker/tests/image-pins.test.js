// Image pinning and Docker Hub login rules (docs/docker.md). Runs in the docker-build CI job:
//   node --test ops/docker/tests/image-pins.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pins = require("../image-pins.js");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const DIGEST = "@sha256:" + "a".repeat(64);
const refsOf = (list) => list.map((r) => r.ref);

test("checkRef accepts only an exact version tag plus a digest", () => {
  for (const ok of ["node:24.22.1-slim" + DIGEST, "axllent/mailpit:v1.27.11" + DIGEST, "ghcr.io/org/tool:1.2.3" + DIGEST,
    "localhost:5000/team/app:2.0.0-rc.1" + DIGEST]) assert.equal(pins.checkRef(ok), null, ok);
  assert.match(pins.checkRef("node:24-slim"), /not pinned/);
  assert.match(pins.checkRef("mongo:7.0"), /not pinned/);
  assert.match(pins.checkRef("mongo"), /not pinned/);
  assert.match(pins.checkRef("rhysd/actionlint" + DIGEST), /exact version tag/);
  assert.match(pins.checkRef("caddy:2-alpine" + DIGEST), /not an exact/);
  assert.match(pins.checkRef("busybox:latest" + DIGEST), /not an exact/);
  assert.match(pins.checkRef("axllent/mailpit:v1.27" + DIGEST), /not an exact/);
  assert.match(pins.checkRef("node:24.1.0@sha256:abc"), /not pinned/);
  assert.match(pins.checkRef("${OLLAMA_IMAGE}"), /not pinned/);
});

test("Dockerfiles: FROM lines and external COPY --from, not build stages or scratch", () => {
  const refs = pins.dockerfileRefs([
    "FROM --platform=linux/amd64 node:24-slim AS build",
    "RUN npm ci",
    "FROM build AS test",
    "FROM \\",
    "  nginx:1.29.0 AS runtime",
    "COPY --from=build /app /app",
    "COPY --from=0 /x /x",
    "COPY --from=busybox:1.37.0 /bin/sh /sh",
    "FROM scratch",
  ].join("\n"));
  assert.deepEqual(refsOf(refs), ["node:24-slim", "nginx:1.29.0", "busybox:1.37.0"]);
});

test("compose: image keys and ${VAR:-default}, skipping services built from a local Dockerfile", () => {
  const refs = pins.composeRefs([
    "services:",
    "  mongo:",
    "    image: mongo:7.0  # comment",
    "  backend:",
    "    image: nabad-backend:e2e",
    "    build:",
    "      context: ./backend",
    "  frontend:",
    "    build: ./frontend",
    "    image: nabad-frontend:e2e",
    "  gateway:",
    "    image: \"${CADDY_IMAGE:-caddy:2-alpine}\"",
    "  # image: commented:1",
  ].join("\n"));
  assert.deepEqual(refsOf(refs), ["mongo:7.0", "caddy:2-alpine"]);
  assert.deepEqual(refs.map((r) => r.line), [3, 12]);
});

test("workflows: services, container, docker:// actions, buildx driver image and docker run/pull", () => {
  const refs = pins.workflowRefs([
    "jobs:",
    "  a:",
    "    container: node:24",
    "    services:",
    "      db:",
    "        image: mongo:7.0",
    "    steps:",
    "      - uses: docker://alpine:3.22",
    "      - uses: docker/setup-buildx-action@v3",
    "        with:",
    "          driver-opts: image=moby/buildkit:latest",
    "      - run: docker pull redis:8",
    "      - run: >-",
    "          docker run --rm -v \"$PWD:/repo:ro\" -w /repo",
    "          rhysd/actionlint:1.7.7",
    "          -no-color x.yml",
    "      - run: |",
    "          echo hi",
    "          docker container run --name x -e A=1 \\",
    "            busybox:1 true",
    "          docker run --rm",
    "          echo not-an-image",
  ].join("\n"));
  assert.deepEqual(refsOf(refs), ["node:24", "mongo:7.0", "alpine:3.22", "moby/buildkit:latest", "redis:8",
    "rhysd/actionlint:1.7.7", "busybox:1"]);
});

test("env files: *_IMAGE defaults", () => {
  assert.deepEqual(refsOf(pins.envRefs("A=1\nOLLAMA_IMAGE=ollama/ollama:0.34.0\n# X_IMAGE=commented\n")), ["ollama/ollama:0.34.0"]);
});

test("file kinds", () => {
  assert.equal(pins.kindOf("backend/Dockerfile"), "dockerfile");
  assert.equal(pins.kindOf("Dockerfile.dev"), "dockerfile");
  assert.equal(pins.kindOf("docker-compose.ai.yml"), "compose");
  assert.equal(pins.kindOf("ai-server/compose.gpu.yaml"), "compose");
  assert.equal(pins.kindOf("loadtest/jmeter/docker-compose.loadtest.yml"), "compose");
  assert.equal(pins.kindOf(".github/workflows/e2e.yml"), "workflow");
  assert.equal(pins.kindOf("ai-server/.env.example"), "env");
  assert.equal(pins.kindOf("ops/backup/versions.env"), "env");
  assert.equal(pins.kindOf("render.yaml"), null);
});

test("every image in the repository is pinned by exact tag and digest", () => {
  const { refs, problems } = pins.scanRepo(ROOT);
  assert.deepEqual(problems.map((p) => `${p.file}:${p.line}: ${p.ref} ${p.problem}`), []);
  const files = new Set(refs.map((r) => r.file));
  // Guards against the scanner silently finding nothing.
  for (const f of ["backend/Dockerfile", "frontend/Dockerfile", "docker-compose.yml", "docker-compose.ai.yml",
    "ai-server/compose.yaml", ".github/workflows/db-backup.yml", ".github/workflows/e2e.yml", ".github/workflows/tests.yml"])
    assert.ok(files.has(f), `no image found in ${f}`);
  assert.ok(refs.length >= 15, `only ${refs.length} image references found`);
});

// ---- Docker Hub login ----------------------------------------------------------------------------
const workflowFiles = fs.readdirSync(path.join(ROOT, ".github/workflows")).filter((f) => /\.ya?ml$/.test(f));
const readWorkflow = (f) => fs.readFileSync(path.join(ROOT, ".github/workflows", f), "utf8").replace(/\r\n/g, "\n");

function jobsOf(text) {
  const lines = text.split("\n");
  const start = lines.indexOf("jobs:");
  const jobs = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(lines[i]);
    if (m) jobs.push({ name: m[1], lines: [] });
    else if (jobs.length) jobs[jobs.length - 1].lines.push(lines[i]);
  }
  return jobs;
}

const PULLS = /docker (?:run|pull|build|compose (?:up|pull|build))\b|docker\/(?:build-push|setup-buildx)-action/;
const LOGIN_ACTION = /^\s*uses: docker\/login-action@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;

test("every job that pulls from Docker Hub logs in first, skipping the login without secrets", () => {
  let checked = 0;
  for (const file of workflowFiles) {
    const text = readWorkflow(file);
    for (const job of jobsOf(text)) {
      const firstPull = job.lines.findIndex((l) => !l.trim().startsWith("#") && PULLS.test(l));
      if (firstPull === -1) continue;
      checked++;
      const where = `${file} job ${job.name}`;
      const login = job.lines.findIndex((l) => LOGIN_ACTION.test(l));
      assert.ok(login !== -1, `${where}: no docker/login-action pinned by commit SHA`);
      assert.ok(login < firstPull, `${where}: logs in after its first pull`);
      const step = job.lines.slice(login - 2, login + 4).join("\n");
      assert.match(step, /if: env\.DOCKERHUB_USERNAME != ''/, `${where}: login is not skipped without secrets`);
      assert.match(step, /username: \$\{\{ env\.DOCKERHUB_USERNAME \}\}/, where);
      assert.match(step, /password: \$\{\{ secrets\.DOCKERHUB_TOKEN \}\}/, where);
      assert.match(text, /DOCKERHUB_USERNAME: \$\{\{ secrets\.DOCKERHUB_USERNAME \}\}/, `${where}: DOCKERHUB_USERNAME env missing`);
    }
  }
  assert.ok(checked >= 3, `only ${checked} pulling jobs found`);
});

test("service containers pull with Docker Hub credentials", () => {
  let checked = 0;
  for (const file of workflowFiles) {
    for (const job of jobsOf(readWorkflow(file))) {
      const s = job.lines.findIndex((l) => /^ {4}services:\s*$/.test(l));
      if (s === -1) continue;
      const services = [];
      for (let i = s + 1; i < job.lines.length && !/^ {4}\S/.test(job.lines[i]); i++) {
        if (/^ {6}[A-Za-z0-9_-]+:\s*$/.test(job.lines[i])) services.push([]);
        else if (services.length) services[services.length - 1].push(job.lines[i]);
      }
      for (const svc of services) {
        checked++;
        const text = svc.join("\n");
        assert.match(text, /\n {8}credentials:\n {10}username: \$\{\{ secrets\.DOCKERHUB_USERNAME \}\}\n {10}password: \$\{\{ secrets\.DOCKERHUB_TOKEN \}\}/,
          `${file} job ${job.name}: a service container has no Docker Hub credentials`);
      }
    }
  }
  assert.ok(checked >= 1, "no service containers found (db-backup.yml has one)");
});

test("the Docker Hub token is only ever passed as a password, never to a shell", () => {
  for (const file of workflowFiles) {
    readWorkflow(file).split("\n").forEach((line, i) => {
      if (line.includes("DOCKERHUB_TOKEN")) assert.match(line, /^\s*password: \$\{\{ secrets\.DOCKERHUB_TOKEN \}\}$/, `${file}:${i + 1}`);
    });
  }
});
