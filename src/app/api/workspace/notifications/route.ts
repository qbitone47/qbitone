import { NextRequest, NextResponse } from "next/server";
import { listNotifications, type WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/workspace/notifications — the ONE centralized notification feed
// (fixture seed + live meeting invites/cancellations) from the shared
// workspace store, so the desktop notification center and the mobile
// notification screen render the same server-side state.
export async function GET(req: NextRequest) {
  return NextResponse.json(listNotifications(roleFrom(req)));
}
