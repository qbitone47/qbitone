#!/usr/bin/env bun
// ============================================================
// Qubit One — repository secret scan (Phase 24, spec §8/§26/§28/§35).
//
// Scans every git-tracked text file for credential-shaped patterns.
// On a finding it prints the PATTERN NAME and LOCATION ONLY — never
// the matched content (§8: do not print secrets in CI output, logs
// or reports). Wired into CI and into the deployment gate.
//
// Exit codes: 0 = clean · 1 = findings · 2 = scan could not run.
// ============================================================

import { readFileSync } from "node:fs";

interface ScanPattern {
  id: string;
  description: string;
  regex: RegExp;
  /** Line-level allowlist (documented placeholders, CI test values). */
  allow?: RegExp;
}

const PATTERNS: ScanPattern[] = [
  {
    id: "supabase-service-key",
    description: "Supabase service-role / secret key literal (sbp_… / sb_secret_…)",
    regex: /\b(?:sbp_[a-f0-9]{40,}|sb_secret_[A-Za-z0-9_-]{20,})\b/g,
  },
  {
    id: "supabase-service-jwt",
    description: "Supabase service_role JWT fragment",
    regex: /InNlcnZpY2Vfcm9sZSI6|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{40,}/g,
    // Detection-rule definitions are not credentials: allow the scanner's own
    // pattern line, smoke-test's SECRET_MARKERS regex (both contain the bare
    // marker literal as a DETECTION rule — verified self-match, not a secret).
    allow: /regex:|SECRET_MARKERS|\{\d+,\}/,
  },
  {
    id: "database-url-with-credentials",
    description: "Database URL with embedded credentials (non-localhost)",
    regex: /\bpostgres(?:ql)?:\/\/[^\s"'@/]+:[^\s"'@]+@[^\s"'<>]+/g,
    allow: /@localhost[:/\s]/,
  },
  {
    id: "github-pat",
    description: "GitHub personal access token",
    regex: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,255})\b/g,
  },
  {
    id: "aws-access-key",
    description: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "private-key-block",
    description: "Embedded private key block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/g,
  },
  {
    id: "slack-token",
    description: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    id: "openai-style-key",
    description: "OpenAI-style API key",
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    allow: /ci-test-secret-not-a-real-credential|sk-[A-Za-z0-9_-]*sketch/,
  },
  {
    id: "hard-coded-secret-assignment",
    description: "Hard-coded secret-shaped assignment (SECRET/TOKEN/PASSWORD/API_KEY = long literal)",
    regex: /\b(?:SECRET|TOKEN|PASSWORD|API_KEY|APIKEY|ACCESS_KEY)[A-Z_]*\s*[:=]\s*["'][A-Za-z0-9+/=_-]{24,}["']/g,
    allow: /process\.env|import\.meta\.env|YOUR|EXAMPLE|PLACEHOLDER|<[^>]+>/i,
  },
];

/** Binary / generated artifacts that are not scannable text. */
const SKIP_SUFFIXES = [
  ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2",
  ".ttf", ".eot", ".mp4", ".webm", ".zip", ".gz", ".br", ".pdf", ".icns",
];
const SKIP_FILES = new Set(["bun.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);

const tracked = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: process.cwd() });
if (tracked.exitCode !== 0) {
  console.error("SECRET SCAN: NOT RUN — git ls-files failed (run inside the repository).");
  process.exit(2);
}

const files = new TextDecoder()
  .decode(tracked.stdout)
  .split("\0")
  .filter(Boolean)
  .filter((f) => !SKIP_SUFFIXES.some((s) => f.endsWith(s)))
  .filter((f) => !SKIP_FILES.has(f));

let findings = 0;
let scanned = 0;

for (const file of files) {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue; // unreadable (deleted/binary) — the next scan sees it via git
  }
  scanned += 1;
  const lines = content.split("\n");
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      pattern.regex.lastIndex = 0;
      const m = pattern.regex.exec(line);
      if (!m) continue;
      if (pattern.allow?.test(line)) continue;
      // §8: report location + pattern only. NEVER print the match.
      console.log(`FINDING pattern=${pattern.id} file=${file}:${i + 1} — ${pattern.description}`);
      findings += 1;
    }
  }
}

if (findings > 0) {
  console.log(`SECRET SCAN: FAIL — ${findings} finding(s) across ${scanned} scanned files. Remove the secret, rotate it if it was ever pushed, and keep real values only in the platform secret store.`);
  process.exit(1);
}
console.log(`SECRET SCAN: PASS — no credential-shaped content in ${scanned} scanned files (${PATTERNS.length} patterns).`);
