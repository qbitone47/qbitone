import { NextRequest, NextResponse } from "next/server";
import { mobileGet, mobilePost, sectionFor, type MobileAction } from "@/lib/qubit/mobile-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/mobile?section=…&id=… — one composed mobile endpoint over
// the authoritative existing Qubit One systems. Scoping (sales own/
// team/company), approval authority, mailbox scope and participant
// checks are enforced server-side in mobile-server — never the UI.
export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");
  const resolved = sectionFor(section);
  if (!resolved) {
    return NextResponse.json({ code: "bad_section", message: "Unknown mobile section." }, { status: 400 });
  }
  const result = await mobileGet(roleFrom(req), resolved, req.nextUrl.searchParams);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

// POST /api/mobile — every consequential mobile action (task and
// approval decisions, attendance punches, visit execution, WhatsApp
// replies, mail, profile, card share, mobile AI). Validation,
// permissions, transitions and audit are enforced server-side;
// delegated actions ride the existing systems' own enforcement.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }
  const type = typeof body.type === "string" ? body.type : undefined;
  if (!type) {
    return NextResponse.json({ code: "bad_request", message: "Provide the action type." }, { status: 400 });
  }
  const input = (body.input ?? {}) as Record<string, unknown>;
  const result = await mobilePost(roleFrom(req), { type, input } as unknown as MobileAction);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  // mobilePost already returns the flattened Qubit shape: { ok, message, ...payload }
  return NextResponse.json(result);
}
