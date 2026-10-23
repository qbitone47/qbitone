#!/usr/bin/env bun
// ============================================================
// Qubit One — production deployment gate (Phase 24, spec §36).
//
//   Repository clean + CI passing + build passing + database ready
//   + security checks passing + required env vars present
//   + backup readiness acknowledged = production deployment allowed
//
// This script evaluates every gate it can verify programmatically
// and reports each one with an honest status:
//   PASS · FAIL · WARN · NOT CONFIGURED · NOT RUN
// Gates delegated to CI (lint / typecheck / build / smoke) are
// reported as such, never claimed as locally verified.
//
// Usage:
//   bun scripts/deploy/deployment-gate.ts [--ci]
//     (no flag) release mode — includes repository state checks
//     --ci      CI mode — skips repo-state checks that CI enforces
//               itself (clean tree, branch, sync with origin)
//
// Exit codes: 0 = no FAIL (deployment allowed) · 1 = blocked.
// A FAIL here means: STOP. Do not fake success (§37).
// ============================================================

import { readFileSync, existsSync } from "node:fs";

const CI_MODE = process.argv.includes("--ci");
const results: Array<{ gate: string; status: string; detail: string }> = [];

function record(gate: string, status: "PASS" | "FAIL" | "WARN" | "NOT CONFIGURED" | "NOT RUN", detail: string): void {
  results.push({ gate, status, detail });
}

function sh(cmd: string[]): { code: number; out: string } {
  const p = Bun.spawnSync(cmd, { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(p.stdout).trim();
  const stderr = new TextDecoder().decode(p.stderr).trim();
  // Prisma and friends print diagnostics on stderr; keep them for detail.
  return { code: p.exitCode ?? 1, out: [stdout, stderr].filter(Boolean).join("\n") };
}

// ------------------------------------------------------------
// 1 · Repository state (release mode only — §5/§35)
// ------------------------------------------------------------
if (!CI_MODE) {
  const branch = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
  const dirty = sh(["git", "status", "--porcelain"]);
  const sync = sh(["git", "rev-list", "--left-right", "--count", "origin/main...HEAD"]);
  const branchOk = branch.out === "main";
  record("Repository · branch", branchOk ? "PASS" : "FAIL", branchOk ? `on main (${branch.out})` : `on "${branch.out}" — production releases deploy from main`);
  const clean = dirty.out.length === 0;
  record("Repository · working tree", clean ? "PASS" : "FAIL", clean ? "clean" : `${dirty.out.split("\n").length} uncommitted change(s)`);
  const [behind, ahead] = sync.out.split("\t").map((n) => Number(n) || 0);
  record(
    "Repository · sync with origin/main",
    ahead === 0 && behind === 0 ? "PASS" : "WARN",
    `ahead ${ahead} · behind ${behind} (as of the last fetch — run 'git fetch origin' for certainty)`,
  );
} else {
  record("Repository state", "NOT RUN", "delegated to CI mode — GitHub enforces branch and PR state");
}

// ------------------------------------------------------------
// 2 · Secret scan (§8/§26/§28)
// ------------------------------------------------------------
{
  const scan = sh(["bun", "scripts/security/secret-scan.ts"]);
  record("Security · secret scan", scan.code === 0 ? "PASS" : "FAIL", scan.code === 0 ? scan.out.split("\n").pop() ?? "clean" : `${scan.out.split("\n").length} finding(s) — remove and rotate the affected credential(s)`);
}

// ------------------------------------------------------------
// 3 · Environment variable coverage (§7/§24)
// ------------------------------------------------------------
{
  const documented = new Set<string>();
  const example = existsSync(".env.example") ? readFileSync(".env.example", "utf8") : "";
  for (const line of example.split("\n")) {
    const m = line.match(/^\s*#?\s*([A-Z_][A-Z0-9_]*)\s*=/);
    if (m) documented.add(m[1]);
  }
  // Platform-injected runtime variables that are never authored in .env files.
  const systemVars = new Set([
    "NODE_ENV", "PORT", "CI",
    "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_REGION", "VERCEL_PROJECT_PRODUCTION_BRANCH",
    "VERCEL_DEPLOYMENT_ID", "VERCEL_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_REF", "VERCEL_GIT_COMMIT_MESSAGE",
    "VERCEL_GIT_COMMIT_AUTHOR_LOGIN", "VERCEL_GIT_COMMIT_AUTHOR_NAME", "VERCEL_GIT_PULL_REQUEST_ID",
  ]);
  const referenced = new Set<string>();
  const glob = new Bun.Glob("src/**/*.{ts,tsx}");
  for await (const rel of glob.scan({ cwd: process.cwd() })) {
    const text = readFileSync(rel, "utf8");
    for (const m of text.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) referenced.add(m[1]);
  }
  for (const text of ["next.config.ts", "prisma/schema.prisma"]) {
    if (!existsSync(text)) continue;
    for (const m of readFileSync(text, "utf8").matchAll(/env\("([A-Z_][A-Z0-9_]*)"\)/g)) referenced.add(m[1]);
  }
  const undocumented = [...referenced].filter((v) => !documented.has(v) && !systemVars.has(v));
  record(
    "Environment · every referenced variable documented",
    undocumented.length === 0 ? "PASS" : "FAIL",
    undocumented.length === 0
      ? `${referenced.size} referenced variable(s) all documented in .env.example or platform-injected`
      : `referenced in code but missing from .env.example: ${undocumented.join(", ")}`,
  );
  const nextPublic = sh(["git", "grep", "-l", "-E", "NEXT_PUBLIC_[A-Z_]*(SECRET|TOKEN|KEY|PASSWORD|DATABASE)"]);
  record(
    "Environment · no sensitive NEXT_PUBLIC_* exposure",
    nextPublic.code !== 0 ? "PASS" : "FAIL",
    nextPublic.code !== 0 ? "no sensitive variable is exposed through NEXT_PUBLIC_*" : `files exposing sensitive NEXT_PUBLIC_* names: ${nextPublic.out.split("\n").join(", ")}`,
  );
}

// ------------------------------------------------------------
// 4 · Database schema validation (§16/§17)
// ------------------------------------------------------------
{
  const validate = sh(["bunx", "prisma", "validate"]);
  const errorLine = validate.out.split("\n").filter((l) => /^error:|Error code:/.test(l)).join(" ");
  record("Database · Prisma schema valid", validate.code === 0 ? "PASS" : "FAIL", validate.code === 0 ? "prisma validate passed" : errorLine || validate.out.split("\n").slice(-2).join(" "));
}

// ------------------------------------------------------------
// 5 · Dependency audit — blocking on CRITICAL only (§26/§29)
// ------------------------------------------------------------
{
  const audit = sh(["bun", "audit", "--json"]);
  if (audit.out.length === 0) {
    record("Security · dependency audit", "FAIL", "bun audit produced no output — verify locally");
  } else {
    const counts = { critical: 0, high: 0, moderate: 0, low: 0 } as Record<string, number>;
    for (const m of audit.out.matchAll(/"severity":\s*"(critical|high|moderate|low)"/g)) counts[m[1]] += 1;
    const total = counts.critical + counts.high + counts.moderate + counts.low;
    record(
      "Security · dependency audit (critical gate)",
      counts.critical === 0 ? "PASS" : "FAIL",
      counts.critical === 0
        ? `${total} non-blocking advisor(ies) (high ${counts.high} · moderate ${counts.moderate} · low ${counts.low}) — reviewed in docs/DEPLOYMENT.md; a critical count > 0 blocks this gate`
        : `${counts.critical} CRITICAL advisor(ies) present — upgrade the affected package before deploying`,
    );
  }
}

// ------------------------------------------------------------
// 6 · Backup / DR readiness (§25 — Phase 22 owns the capability)
// ------------------------------------------------------------
{
  const doc = existsSync("docs/DEPLOYMENT.md") ? readFileSync("docs/DEPLOYMENT.md", "utf8") : "";
  const hasBackup = /## .*Backup/i.test(doc);
  const hasRollback = /## .*Rollback/i.test(doc);
  const hasIncident = /Incident/i.test(doc);
  const docsOk = hasBackup && hasRollback && hasIncident;
  record(
    "Backup/DR · documentation gate",
    docsOk ? "WARN" : "FAIL",
    docsOk
      ? "backup, rollback and incident procedures documented — backup VERIFICATION is provider-managed (Supabase dashboard): a human must confirm a restorable backup exists before any high-risk change; in-app DR checks (P22-16) honestly report not performed"
      : "docs/DEPLOYMENT.md is missing the backup/rollback/incident sections",
  );
}

// ------------------------------------------------------------
// 7 · Health probe of a running instance (§23 — optional here)
// ------------------------------------------------------------
{
  try {
    const res = await fetch("http://localhost:3000/api/health", { signal: AbortSignal.timeout(2000), cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { checks?: { database?: { status?: string } } };
      record("Health · running instance", "PASS", `GET /api/health → 200, database=${json.checks?.database?.status ?? "unknown"}`);
    } else {
      record("Health · running instance", "WARN", `GET /api/health → ${res.status}`);
    }
  } catch {
    record("Health · running instance", "NOT RUN", "no local instance answering on :3000 — CI runs the smoke suite against the built server instead");
  }
}

// ------------------------------------------------------------
// Summary
// ------------------------------------------------------------
const width = Math.max(...results.map((r) => r.gate.length));
console.log("\nProduction deployment gate");
for (const r of results) {
  console.log(`  [${r.status.padEnd(14)}] ${r.gate.padEnd(width)} — ${r.detail}`);
}
const fails = results.filter((r) => r.status === "FAIL").length;
const warns = results.filter((r) => r.status === "WARN").length;
console.log(`\nGATE RESULT: ${fails === 0 ? "ALLOWED" : "BLOCKED"} — ${fails} FAIL · ${warns} WARN · lint/typecheck/build/smoke are enforced by CI on this exact commit.`);
process.exit(fails > 0 ? 1 : 0);
