import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import {
  listMail,
  markMail,
  retryMail,
  saveDraft,
  sendMail,
  type WorkspaceRole,
} from "@/lib/qubit/workspace-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// Phase 21: the acting role is derived from the signed session cookie
// (server-verified) — a client-declared role header is never trusted.
// Fail-closed: requests without a valid session receive 401.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole; userId: string } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole, userId: auth.identity.userId }
    : { ok: false, response: auth.response };
}

// GET /api/workspace/mail — authorized mailbox scope, server-filtered.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/workspace/mail", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    const sp = req.nextUrl.searchParams;
    const result = listMail(actor.role, {
      folder: sp.get("folder") ?? "inbox",
      q: sp.get("q") ?? undefined,
      unreadOnly: sp.get("unread") === "1",
      label: sp.get("label") ?? undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    }, actor.userId);
    return NextResponse.json(result);
  });
}

// POST /api/workspace/mail — send | draft | retry | mark.
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/workspace/mail", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    let body: {
      action?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      body?: string;
      draftId?: string;
      id?: string;
      read?: boolean;
      starred?: boolean;
      archive?: boolean;
      attachments?: { name: string; sizeKb: number; type: string }[];
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
    }

    switch (body.action) {
      case "send": {
        const result = sendMail(actor.role, {
          to: body.to ?? [],
          cc: body.cc,
          bcc: body.bcc,
          subject: body.subject ?? "",
          body: body.body ?? "",
          attachments: body.attachments,
        }, actor.userId);
        return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      case "draft": {
        const result = saveDraft(actor.role, body as never, actor.userId);
        return NextResponse.json(result);
      }
      case "retry": {
        if (!body.id) return NextResponse.json({ code: "bad_request", message: "Message id required." }, { status: 400 });
        const result = retryMail(actor.role, body.id, actor.userId);
        return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      case "mark": {
        if (!body.id) return NextResponse.json({ code: "bad_request", message: "Message id required." }, { status: 400 });
        const result = markMail(actor.role, body.id, { read: body.read, starred: body.starred, archive: body.archive }, actor.userId);
        return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      default:
        return NextResponse.json({ code: "bad_request", message: "Unknown mail action." }, { status: 400 });
    }
  });
}
