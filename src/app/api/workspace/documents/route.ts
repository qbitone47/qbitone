import { NextRequest, NextResponse } from "next/server";
import { documentAction, type WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// POST /api/workspace/documents — upload | download | share | rename | move.
// Restricted-document access and ownership rules are enforced here,
// independent of what the UI chooses to render.
export async function POST(req: NextRequest) {
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

  const result = documentAction(roleFrom(req), { ...body, action });
  return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
}
