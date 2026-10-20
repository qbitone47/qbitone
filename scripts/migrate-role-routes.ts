// One-shot Phase 21 route migration: replace client-trusted X-Qubit-Role
// resolution with the fail-closed server session identity gate.
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "src/app/api/analytics/route.ts",
  "src/app/api/executive/route.ts",
  "src/app/api/mobile/route.ts",
  "src/app/api/platform/route.ts",
  "src/app/api/sales/route.ts",
  "src/app/api/sales-ai/route.ts",
  "src/app/api/search/route.ts",
  "src/app/api/workspace/approvals/route.ts",
  "src/app/api/workspace/documents/route.ts",
  "src/app/api/workspace/mail/route.ts",
  "src/app/api/workspace/meetings/route.ts",
  "src/app/api/workspace/notifications/route.ts",
  "src/app/api/workspace/profile/route.ts",
  "src/app/api/workspace/tasks/route.ts",
];

const HELPER = `// Phase 21: the acting role is derived from the signed session cookie
// (server-verified) — a client-declared role header is never trusted.
// Fail-closed: requests without a valid session receive 401.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole }
    : { ok: false, response: auth.response };
}`;

const GATE = `  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;
`;

for (const file of files) {
  let src = readFileSync(file, "utf8");

  if (!src.includes("roleFrom")) { console.log(`SKIP (no roleFrom): ${file}`); continue; }

  // 1. Add requireIdentity import after the next/server import line.
  if (!src.includes("requireIdentity")) {
    src = src.replace(
      /(import \{[^}]*\} from "next\/server";\n)/,
      `$1import { requireIdentity } from "@/lib/qubit/auth-server";\n`,
    );
  }

  // 2. Replace the roleFrom const with the identityFrom helper.
  const roleFromRe = /const roleFrom = \(req: NextRequest\): WorkspaceRole =>\n\s*\(req\.headers\.get\("X-Qubit-Role"\) as WorkspaceRole\) \?\? "administrator";\n/;
  if (!roleFromRe.test(src)) { console.log(`PATTERN MISS roleFrom: ${file}`); continue; }
  src = src.replace(roleFromRe, HELPER + "\n");

  // 3. tasks GET has no req param — add it.
  src = src.replace("export async function GET() {", "export async function GET(req: NextRequest) {");

  // 4. Insert the gate at the top of every exported handler.
  src = src.replace(
    /export async function (GET|POST|PATCH|PUT|DELETE)\(req: NextRequest\) \{\n/g,
    (m) => m + GATE,
  );

  // 5. Replace roleFrom callsites.
  src = src.split("roleFrom(req)").join("actor.role");

  writeFileSync(file, src);
  console.log(`MIGRATED: ${file}`);
}
console.log("done");
