import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { documentAction, type WorkspaceRole } from "@/lib/qubit/workspace-server";

// Phase 21: the acting role is derived from the signed session cookie
// (server-verified) — a client-declared role header is never trusted.
// Fail-closed: requests without a valid session receive 401.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole }
    : { ok: false, response: auth.response };
}

// POST /api/workspace/documents — upload | download | share | rename | move.
// Restricted-document access and ownership rules are enforced here,
// independent of what the UI chooses to render.
export async function POST(req: NextRequest) {
  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;
  let body: {
    action?: string;
    docId?: string;
    name?: string;
    category?: string;
    toEmployeeId?: string;
    fileMeta?: { name: string; sizeKb: number; type: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }
  const action = body.action as "download" | "share" | "rename" | "move" | "upload" | undefined;
  if (!action) return NextResponse.json({ code: "bad_request", message: "Document action required." }, { status: 400 });

  const result = documentAction(actor.role, { ...body, action });
  return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
}
