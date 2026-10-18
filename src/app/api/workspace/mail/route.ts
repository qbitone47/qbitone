import { NextRequest, NextResponse } from "next/server";
import {
  listMail,
  markMail,
  retryMail,
  saveDraft,
  sendMail,
  type WorkspaceRole,
} from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/workspace/mail — authorized mailbox scope, server-filtered.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listMail(roleFrom(req), {
    folder: sp.get("folder") ?? "inbox",
    q: sp.get("q") ?? undefined,
    unreadOnly: sp.get("unread") === "1",
    label: sp.get("label") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });
  return NextResponse.json(result);
}

// POST /api/workspace/mail — send | draft | retry | mark.
export async function POST(req: NextRequest) {
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
      const result = sendMail(roleFrom(req), {
        to: body.to ?? [],
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject ?? "",
        body: body.body ?? "",
        attachments: body.attachments,
      });
      return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    case "draft": {
      const result = saveDraft(roleFrom(req), body as never);
      return NextResponse.json(result);
    }
    case "retry": {
      if (!body.id) return NextResponse.json({ code: "bad_request", message: "Message id required." }, { status: 400 });
      const result = retryMail(roleFrom(req), body.id);
      return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    case "mark": {
      if (!body.id) return NextResponse.json({ code: "bad_request", message: "Message id required." }, { status: 400 });
      const result = markMail(roleFrom(req), body.id, { read: body.read, starred: body.starred, archive: body.archive });
      return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    default:
      return NextResponse.json({ code: "bad_request", message: "Unknown mail action." }, { status: 400 });
  }
}
