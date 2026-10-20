// One-shot Phase 21 client migration: session-gate every direct fetch helper.
import { readFileSync, writeFileSync } from "node:fs";

const IMPORT_LINE = `import { ensureSession } from "@/lib/qubit/api";\n`;

// file → [anchor-regex source, whether role param is optional (needs ?? "administrator")]
const targets: Array<{ file: string; fns: RegExp[]; optionalRole: boolean; reactAnchor: RegExp }> = [
  {
    file: "src/components/qubit/sales/parts.tsx",
    optionalRole: false,
    reactAnchor: /^import \* as React from "react";\n/m,
    fns: [/export async function salesGet<T>\([^)]*\): Promise<T> \{\n/, /export async function salesPost<T = \{ ok: boolean; message\?: string \}>\(\n[^)]*\): Promise<T> \{\n/],
  },
  {
    file: "src/components/qubit/analytics/parts.tsx",
    optionalRole: false,
    reactAnchor: /^import \* as React from "react";\n/m,
    fns: [/export async function analyticsGet<T>\([^)]*\): Promise<T> \{\n/, /export async function analyticsPost<T = \{ ok: boolean; message\?: string \}>\(\n[^)]*\): Promise<T> \{\n/],
  },
  {
    file: "src/components/qubit/executive/parts.tsx",
    optionalRole: false,
    reactAnchor: /^import \* as React from "react";\n/m,
    fns: [/export async function execGet<T>\([^)]*\): Promise<T> \{\n/, /export async function execPost<T = \{ ok: boolean \}>\(\n[^)]*\): Promise<T> \{\n/],
  },
  {
    file: "src/components/qubit/mobile/parts.tsx",
    optionalRole: true,
    reactAnchor: /^import \* as React from "react";\n/m,
    fns: [/export async function mobileGet<T>\(\n[^)]*\): Promise<T> \{\n/, /export async function mobilePost<T = \{ ok: boolean; message\?: string \}>\(\n[^)]*\): Promise<T> \{\n/],
  },
  {
    file: "src/components/qubit/platform/parts.tsx",
    optionalRole: false,
    reactAnchor: /^import \* as React from "react";\n/m,
    fns: [/export async function platformGet<T>\([^)]*\): Promise<T> \{\n/, /export async function platformPost<T = \{ ok: boolean; message\?: string \}>\(\n[^)]*\): Promise<T> \{\n/],
  },
];

for (const t of targets) {
  let src = readFileSync(t.file, "utf8");
  if (!src.includes('ensureSession')) {
    if (!t.reactAnchor.test(src)) { console.log(`ANCHOR MISS (react import): ${t.file}`); continue; }
    src = src.replace(t.reactAnchor, `$&${IMPORT_LINE}`);
  }
  const gate = t.optionalRole ? `  await ensureSession(role ?? "administrator");\n` : `  await ensureSession(role);\n`;
  let applied = 0;
  for (const fnRe of t.fns) {
    const m = src.match(fnRe);
    if (!m) { console.log(`FN MISS in ${t.file}: ${fnRe.source.slice(0, 50)}`); continue; }
    src = src.replace(fnRe, (match) => match + gate);
    applied += 1;
  }
  writeFileSync(t.file, src);
  console.log(`GATED (${applied} fns): ${t.file}`);
}
console.log("done");
