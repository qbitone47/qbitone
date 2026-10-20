import { NextRequest, NextResponse } from "next/server";
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

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/workspace/meetings — the session user's meetings + calendar
// events, scoped server-side. Optional ?id= returns a single meeting
// detail (notes and action items included).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const result = getMeeting(roleFrom(req), id);
    return result.ok
      ? NextResponse.json(result)
      : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(listMeetings(roleFrom(req)));
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
      const result = createMeeting(roleFrom(req), {
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
      const result = cancelMeeting(roleFrom(req), { id: body.id, reason: body.reason ?? "" });
      return result.ok
        ? NextResponse.json(result)
        : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    case "notes": {
      if (!body.id) return NextResponse.json({ code: "bad_request", message: "Provide a meeting id." }, { status: 400 });
      const result = saveMeetingNotes(roleFrom(req), { id: body.id, text: body.text ?? "" });
      return result.ok
        ? NextResponse.json(result)
        : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    case "add-action": {
      if (!body.id) return NextResponse.json({ code: "bad_request", message: "Provide a meeting id." }, { status: 400 });
      const result = addMeetingAction(roleFrom(req), {
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
      const result = promoteMeetingAction(roleFrom(req), { id: body.id, index: body.index });
      return result.ok
        ? NextResponse.json(result)
        : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    case "create-event": {
      const result = createCalendarEvent(roleFrom(req), {
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
}
