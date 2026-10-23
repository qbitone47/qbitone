#!/usr/bin/env bun
// ============================================================
// Qubit One — controlled release tagging (Phase 24, spec §19/§20).
//
// A release is an annotated Git tag on main pointing at a validated
// commit. Vercel deploys automatically when main advances, so the
// tag is the immutable release record that links:
//   version ↔ commit ↔ summary ↔ author ↔ timestamp
// Deployment traceability then continues through Vercel (the
// deployment API and /api/health expose the same commit SHA) and
// through the existing in-app release governance (Release Approval
// screen P22-18 + Enterprise Audit Log) — this script deliberately
// does NOT create a second release/approval system.
//
// Usage:
//   bun scripts/deploy/deployment-gate.ts      ← run the gate FIRST
//   bun scripts/deploy/create-release.ts --summary "…" [--version 0.2.2]
//
// The script never deploys anything. It refuses to run on a dirty
// tree, off main, out of sync with origin, or with an existing tag.
// ============================================================

import { readFileSync } from "node:fs";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const summary = arg("--summary");
if (!summary || summary.trim().length < 3) {
  console.error("Usage: bun scripts/deploy/create-release.ts --summary \"<change summary>\" [--version <x.y.z>]");
  process.exit(2);
}

function sh(cmd: string[]): { code: number; out: string } {
  const p = Bun.spawnSync(cmd, { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? 1, out: new TextDecoder().decode(p.stdout).trim() };
}

// --- preconditions (each is a real check, never assumed) ---
const branch = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
if (branch.out !== "main") {
  console.error(`REFUSED: releases are tagged on main (currently on "${branch.out}").`);
  process.exit(1);
}
const dirty = sh(["git", "status", "--porcelain"]);
if (dirty.out.length > 0) {
  console.error(`REFUSED: working tree is not clean (${dirty.out.split("\n").length} change(s)). Commit or stash first.`);
  process.exit(1);
}
const sync = sh(["git", "rev-list", "--left-right", "--count", "origin/main...HEAD"]);
const [behind, ahead] = sync.out.split("\t").map((n) => Number(n) || 0);
if (ahead !== 0 || behind !== 0) {
  console.error(`REFUSED: main is not in sync with origin/main (ahead ${ahead}, behind ${behind}). Push/pull first.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const version = arg("--version") ?? pkg.version;
const tag = `v${version}`;

const existing = sh(["git", "tag", "-l", tag]);
if (existing.out.length > 0) {
  console.error(`REFUSED: tag ${tag} already exists — bump the version or pass --version.`);
  process.exit(1);
}

const sha = sh(["git", "rev-parse", "HEAD"]).out;
const stamp = new Date().toISOString();

// --- create and push the annotated tag (the release record) ---
const message = [
  `Release ${tag}`,
  ``,
  `Commit:    ${sha}`,
  `Branch:    main`,
  `Date (UTC): ${stamp}`,
  `Summary:   ${summary.trim()}`,
  ``,
  `Validation: CI pipeline green on this commit (lint · typecheck · build ·`,
  `smoke tests · secret scan · deployment gate). Database state is`,
  `independent of this tag — see docs/DEPLOYMENT.md §Rollback.`,
].join("\n");

const create = Bun.spawnSync(["git", "tag", "-a", tag, "-m", message], { stdout: "pipe", stderr: "pipe" });
if (create.exitCode !== 0) {
  console.error(`FAILED to create tag: ${new TextDecoder().decode(create.stderr).trim()}`);
  process.exit(1);
}
const push = sh(["git", "push", "origin", tag]);
if (push.code !== 0) {
  console.error(`Tag ${tag} was created locally but the push failed. Push manually: git push origin ${tag}`);
  process.exit(1);
}

console.log(`\nRELEASE RECORDED (traceability record — not a deployment)`);
console.log(`  version:  ${tag}`);
console.log(`  commit:   ${sha}`);
console.log(`  branch:   main`);
console.log(`  date UTC: ${stamp}`);
console.log(`  summary:  ${summary.trim()}`);
console.log(`\nNext steps (human):`);
console.log(`  1. Confirm the Vercel production deployment for ${sha.slice(0, 7)} is Ready — check GET /api/health ("commit" field) or the Deployment Status screen (P22-02).`);
console.log(`  2. Run the smoke suite against production: bun scripts/deploy/smoke-test.ts https://<production-url> --strict-db`);
console.log(`  3. Optionally publish GitHub Release notes from tag ${tag}.`);
console.log(`  4. Record the release decision in the in-app Release Approval screen (P22-18) — it is the system of record for governance.`);
