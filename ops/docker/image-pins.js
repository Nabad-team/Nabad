#!/usr/bin/env node
// Every container image we pull must be pinned by an exact version tag plus a digest
// (image:1.2.3@sha256:...), so a build or CI run can never silently pick up a different image.
// See docs/docker.md ("Updating an image"). Run: node ops/docker/image-pins.js
// Dependency-free on purpose: it runs on the CI runner's preinstalled Node before any npm install.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// name[:port]/path : tag @ sha256:64-hex. The tag must hold an exact x.y.z version, so floating
// tags like latest, 24-slim, 2-alpine or v1.27 fail even when a digest is present.
const PINNED = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::\d+)?(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*:([A-Za-z0-9_][A-Za-z0-9_.-]{0,127})@sha256:[0-9a-f]{64}$/;
const EXACT_VERSION = /\d+\.\d+\.\d+/;

function checkRef(ref) {
  const match = PINNED.exec(ref);
  if (!match) {
    const at = ref.indexOf("@sha256:");
    if (at === -1) return "is not pinned by tag and digest";
    if (!/^@sha256:[0-9a-f]{64}$/.test(ref.slice(at))) return "is not pinned by tag and digest (invalid digest)";
    return "needs an exact version tag before the digest";
  }
  if (!EXACT_VERSION.test(match[1])) return `tag "${match[1]}" is not an exact x.y.z version`;
  return null;
}

const indentOf = (line) => line.length - line.trimStart().length;
const isContent = (line) => line.trim() !== "" && !line.trim().startsWith("#");
const unquote = (value) => value.trim().replace(/\s+#.*$/, "").replace(/^(['"])(.*)\1$/, "$2");

// ${VAR:-default} or ${VAR-default} -> default. A bare variable can't be checked, so it is reported as is.
function resolveDefault(value) {
  const match = /^\$\{[A-Za-z_][A-Za-z0-9_]*:?-([^}]*)\}$/.exec(value);
  return match ? match[1] : value;
}

// --- Dockerfiles: FROM lines and COPY --from=<image> -------------------------------------------
function dockerfileRefs(text) {
  const refs = [];
  const stages = new Set();
  // Join backslash continuations so a split FROM line is still one instruction.
  const lines = text.replace(/\\\r?\n/g, " ").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const from = /^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
    if (from) {
      const image = from[1];
      if (image !== "scratch" && !stages.has(image.toLowerCase())) refs.push({ ref: image, line: i + 1 });
      if (from[2]) stages.add(from[2].toLowerCase());
      return;
    }
    const copy = /^(?:COPY|RUN)\b.*--(?:from|mount=[^\s]*from)=([^\s,]+)/i.exec(line);
    if (copy && !stages.has(copy[1].toLowerCase()) && !/^\d+$/.test(copy[1])) refs.push({ ref: copy[1], line: i + 1 });
  });
  return refs;
}

// --- Compose files: image: keys, except services that are built here (build: in the same block) --
function blockAround(lines, i) {
  const indent = indentOf(lines[i]);
  let start = i;
  while (start > 0 && !(isContent(lines[start - 1]) && indentOf(lines[start - 1]) < indent)) start--;
  let end = i;
  while (end + 1 < lines.length && !(isContent(lines[end + 1]) && indentOf(lines[end + 1]) < indent)) end++;
  return lines.slice(start, end + 1).filter((l) => isContent(l) && indentOf(l) === indent);
}

function composeRefs(text) {
  const lines = text.split(/\r?\n/);
  const refs = [];
  lines.forEach((line, i) => {
    const match = /^\s*image:\s*(.+)$/.exec(line);
    if (!match || line.trim().startsWith("#")) return;
    const builtHere = blockAround(lines, i).some((l) => /^\s*build\s*:/.test(l));
    if (!builtHere) refs.push({ ref: resolveDefault(unquote(match[1])), line: i + 1 });
  });
  return refs;
}

// --- Workflows: services/container images, docker:// actions, buildx driver images, docker run/pull --
// Flags of `docker run`/`docker create` that take a separate value.
const VALUE_FLAGS = new Set(["-v", "--volume", "-w", "--workdir", "-e", "--env", "--env-file", "--name", "-p", "--publish",
  "--entrypoint", "--platform", "--network", "--net", "-u", "--user", "--mount", "-l", "--label", "--add-host", "--cpus",
  "-m", "--memory", "--hostname", "-h", "--pull", "--restart", "--shm-size", "--ulimit", "--device", "--cap-add",
  "--cap-drop", "--security-opt", "--tmpfs", "--log-driver", "--log-opt", "--health-cmd", "--stop-signal"]);

function tokenize(command) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(command))) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

function dockerCommandRefs(command) {
  const refs = [];
  const tokens = tokenize(command);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== "docker") continue;
    let j = i + 1;
    if (tokens[j] === "container" || tokens[j] === "image") j++;
    if (!["run", "create", "pull"].includes(tokens[j])) continue;
    for (j++; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.startsWith("-")) {
        if (VALUE_FLAGS.has(token)) j++;
        continue;
      }
      refs.push(token);
      break;
    }
  }
  return refs;
}

function workflowRefs(text) {
  const lines = text.split(/\r?\n/);
  const refs = [];
  lines.forEach((line, i) => {
    if (line.trim().startsWith("#")) return;
    let m;
    if ((m = /^\s*(?:-\s+)?image:\s*(.+)$/.exec(line))) refs.push({ ref: unquote(m[1]), line: i + 1 });
    else if ((m = /^\s*container:\s*([^\s#{][^#]*)$/.exec(line))) refs.push({ ref: unquote(m[1]), line: i + 1 });
    if ((m = /uses:\s*['"]?docker:\/\/([^\s'"#]+)/.exec(line))) refs.push({ ref: m[1], line: i + 1 });
    if ((m = /\bimage=([^\s,'"]+)/.exec(line))) refs.push({ ref: m[1], line: i + 1 });
  });
  // run: steps, single-line or block scalars (| or >-), with shell continuations joined.
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    let body = m[2];
    if (/^[|>][-+]?\s*$/.test(body)) {
      const parts = [];
      let k = i + 1;
      while (k < lines.length && (lines[k].trim() === "" || indentOf(lines[k]) > indentOf(lines[i]))) parts.push(lines[k++]);
      body = parts.join("\n");
    }
    // A folded scalar (>) is one command line; a literal one (|) is one command per line.
    const joined = body.replace(/\\\r?\n/g, " ");
    const commands = m[2].startsWith(">") ? [joined.replace(/\r?\n/g, " ")] : joined.split(/\r?\n/);
    for (const command of commands) for (const ref of dockerCommandRefs(command)) refs.push({ ref, line: i + 1 });
  }
  return refs;
}

// --- env files that hold image defaults (KEY_IMAGE=...) ----------------------------------------
function envRefs(text) {
  const refs = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const m = /^\s*([A-Z0-9_]*IMAGE)\s*=\s*(\S+)/.exec(line);
    if (m) refs.push({ ref: unquote(m[2]), line: i + 1 });
  });
  return refs;
}

function kindOf(file) {
  const base = path.posix.basename(file);
  if (/^(Dockerfile|Containerfile)([.-].*)?$/.test(base) || base.endsWith(".Dockerfile")) return "dockerfile";
  if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(file)) return "workflow";
  if (/^(docker-)?compose([.-][^/]*)?\.ya?ml$/.test(base)) return "compose";
  if (/(^|\/)\.env(\.[^/]*)?$|\.env$/.test(file)) return "env";
  return null;
}

const EXTRACTORS = { dockerfile: dockerfileRefs, compose: composeRefs, workflow: workflowRefs, env: envRefs };

function findImageRefs(file, text) {
  const kind = kindOf(file);
  return kind ? EXTRACTORS[kind](text).map((r) => ({ ...r, file })) : [];
}

function trackedFiles(root) {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  return out.split("\0").filter((f) => f && kindOf(f) && !f.includes("node_modules/") && !f.startsWith("loadtest/jmeter/reports/"));
}

function scanRepo(root) {
  const refs = [];
  for (const file of trackedFiles(root)) refs.push(...findImageRefs(file, fs.readFileSync(path.join(root, file), "utf8")));
  const problems = refs.map((r) => ({ ...r, problem: checkRef(r.ref) })).filter((r) => r.problem);
  return { refs, problems };
}

module.exports = { checkRef, dockerfileRefs, composeRefs, workflowRefs, envRefs, dockerCommandRefs, kindOf, findImageRefs, scanRepo };

if (require.main === module) {
  const root = path.resolve(__dirname, "..", "..");
  const { refs, problems } = scanRepo(root);
  for (const p of problems) console.error(`${p.file}:${p.line}: ${p.ref} ${p.problem}`);
  console.log(`${refs.length} image references checked, ${problems.length} not pinned (see docs/docker.md, "Updating an image").`);
  process.exit(problems.length ? 1 : 0);
}
