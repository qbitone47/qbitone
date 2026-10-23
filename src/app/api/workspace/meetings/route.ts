import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import {
  addMeetingAction,
  cancelMeeting,
  createCalendarEvent,
  createMeeting,
  getMeeting,
  listMeetings,
  promoteMeetingAction,
  saveMeetingNotes,
  type WorkspaceRole,
} from "@/lib/qubit/workspace-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// Phase 21: the acting role is derived from the signed session cookie
// (server-verified) — a client-declared role header is never trusted.
// Fail-closed: requests without a valid session receive 401.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole }
    : { ok: false, response: auth.response };
}

// GET /api/workspace/meetings — the session user's meetings + calendar
// events, scoped server-side. Optional ?id= returns a single meeting
// detail (notes and action items included).
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/workspace/meetings", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const result = getMeeting(actor.role, id);
      return result.ok
        ? NextResponse.json(result)
        : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    return NextResponse.json(listMeetings(actor.role));
  });
}

// POST /api/workspace/meetings — meeting lifecycle actions.
// Authorization, validation and audit are enforced by the server:
//   { action: "create", title, start, end, participantIds, ... } — schedule
//                                    a meeting; participants are notified
//   { action: "cancel", id, reason }      — cancel a Scheduled meeting
//   { action: "notes", id, text }         — append minutes to the record
//   { action: "add-action", id, title, asTask? } — record an action item,
//                                    optionally also creating a task
//   { action: "promote-action", id, index } — push a recorded action item
//                                    into My Tasks (409 on repeat)
//   { action: "create-event", ...fields } — personal calendar entry (screen 44)
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/workspace/meetings", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    let body: {
      action?: string;
      id?: string;
      reason?: string;
      text?: string;
      title?: string;
      ownerId?: string;
      due?: number | null;
      asTask?: boolean;
      index?: number;
      agenda?: string;
      start?: number;
      end?: number;
      location?: string;
      platform?: string;
      participantIds?: string[];
      type?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
    }
    if (!body.action || typeof body.action !== "string") {
      return NextResponse.json({ code: "bad_request", message: "Provide an action." }, { status: 400 });
    }

    switch (body.action) {
      case "create": {
        const result = createMeeting(actor.role, {
          title: body.title ?? "",
          agenda: body.agenda,
          start: body.start ?? Number.NaN,
          end: body.end ?? Number.NaN,
          location: body.location,
          platform: body.platform,
          participantIds: Array.isArray(body.participantIds) ? body.participantIds : [],
        });
        return result.ok
          ? NextResponse.json(result)
          : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      case "cancel": {
        if (!body.id) return NextResponse.json({ code: "bad_request", message: "Provide a meeting id." }, { status: 400 });
        const result = cancelMeeting(actor.role, { id: body.id, reason: body.reason ?? "" });
        return result.ok
          ? NextResponse.json(result)
          : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      case "notes": {
        if (!body.id) return NextResponse.json({ code: "bad_request", message: "Provide a meeting id." }, { status: 400 });
        const result = saveMeetingNotes(actor.role, { id: body.id, text: body.text ?? "" });
        return result.ok
          ? NextResponse.json(result)
          : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      case "add-action": {
        if (!body.id) return NextResponse.json({ code: "bad_request", message: "Provide a meeting id." }, { status: 400 });
        const result = addMeetingAction(actor.role, {
          id: body.id,
          title: body.title ?? "",
          ownerId: body.ownerId,
          due: body.due ?? null,
          asTask: body.asTask === true,
        });
        return result.ok
          ? NextResponse.json(result)
          : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      case "promote-action": {
        if (!body.id) return NextResponse.json({ code: "bad_request", message: "Provide a meeting id." }, { status: 400 });
        if (typeof body.index !== "number" || !Number.isInteger(body.index) || body.index < 0) {
          return NextResponse.json({ code: "bad_request", message: "Provide the action item index." }, { status: 400 });
        }
        const result = promoteMeetingAction(actor.role, { id: body.id, index: body.index });
        return result.ok
          ? NextResponse.json(result)
          : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      case "create-event": {
        const result = createCalendarEvent(actor.role, {
          title: body.title ?? "",
          type: (body.type ?? "Meeting") as Parameters<typeof createCalendarEvent>[1]["type"],
          start: body.start ?? Number.NaN,
          end: body.end ?? Number.NaN,
          location: body.location,
        });
        return result.ok
          ? NextResponse.json(result)
          : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      default:
        return NextResponse.json({ code: "bad_request", message: `Unknown action "${body.action}".` }, { status: 400 });
    }
  });
}
