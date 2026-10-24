"use client";

import * as React from "react";
import { IdCard, ContactRound, ShieldCheck, Laptop } from "lucide-react";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  MobileBadge,
  MobileCard,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  MobileRow,
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 296 · Mobile Profile — the employee's identity on mobile:
// registry record, self-service edit (server-validated to
// company-controlled boundaries), security/session entry points and
// the two cards (ID + visiting). HR-sensitive fields stay on the
// company-controlled side (spec §17).
// ============================================================

interface ProfilePayload {
  profile: {
    id: string; name: string; title: string; department: string; location: string;
    email: string; phone: string; status: string; since: string; employeeId: string;
    manager: { id: string; name: string; title: string } | null;
  };
  editableFields: string[];
  lockedFieldsNote: string;
  security: { sessions: string; passkeysAvailable: boolean; mfaAvailable: boolean };
  cards: { idCard: string; visitingCard: string };
  role: string;
  sourceNote: string;
}

export function MobileProfileScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, reload } = useMobileSection<ProfilePayload>("profile");
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [phone, setPhone] = React.useState("");

  React.useEffect(() => {
    if (data) setPhone(data.profile.phone);
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await mobilePost<{ message: string }>("profile.update", { phone }, role);
      toast({ title: "Profile updated", description: res.message });
      setEditing(false);
      reload();
    } catch (e) {
      toast({ title: "Update rejected", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame title="Profile" activeTab="profile">
      {loading && <MobileSkeleton rows={3} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          <MobileSection title="Identity">
            <MobileCard>
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-lg font-bold text-white" aria-hidden>
                  {data.profile.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight text-slate-900">{data.profile.name}</p>
                  <p className="truncate text-[12.5px] text-slate-500">{data.profile.title}</p>
                  <p className="text-[11.5px] text-slate-400">{data.profile.department} · {data.profile.location}</p>
                </div>
                <MobileBadge tone="green">{data.profile.status}</MobileBadge>
              </div>
              <dl className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Employee ID</dt><dd className="font-medium tabular-nums text-slate-800">{data.profile.employeeId}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Email</dt><dd className="truncate font-medium text-slate-800">{data.profile.email}</dd></div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-medium tabular-nums text-slate-800">
                    {editing ? (
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        aria-label="Work phone"
                        className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-right text-[12.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    ) : (
                      data.profile.phone
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Manager</dt><dd className="font-medium text-slate-800">{data.profile.manager?.name ?? "—"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Since</dt><dd className="text-slate-800">{data.profile.since}</dd></div>
              </dl>
              {editing ? (
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="min-h-[44px] flex-1 rounded-lg border border-slate-300 text-[13px] font-medium text-slate-700">Cancel</button>
                  <button type="button" disabled={busy} onClick={save} className="min-h-[44px] flex-1 rounded-lg bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40">Save</button>
                </div>
              ) : (
                <button type="button" onClick={() => setEditing(true)} className="mt-3 min-h-[44px] w-full rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-blue-300">
                  Edit permitted fields
                </button>
              )}
            </MobileCard>
          </MobileSection>

          <MobileSection title="Cards">
            <MobileRow
              title="Digital ID Card"
              detail="Company-branded employee identity, verifiable"
              leading={<IdCard className="h-4 w-4 text-slate-400" aria-hidden />}
              onClick={() => nav.navigate("mobile-id-card")}
            />
            <MobileRow
              title="Visiting Card"
              detail="Professional card with QR, vCard and share"
              leading={<ContactRound className="h-4 w-4 text-slate-400" aria-hidden />}
              onClick={() => nav.navigate("mobile-visiting-card")}
            />
          </MobileSection>

          <MobileSection title="Security & sessions">
            <MobileRow
              title="Device & Sessions"
              detail={data.security.sessions}
              leading={<Laptop className="h-4 w-4 text-slate-400" aria-hidden />}
              onClick={() => nav.navigate("device-sessions")}
            />
            <MobileRow
              title="Security Center"
              detail={`MFA ${data.security.mfaAvailable ? "available" : "—"} · passkeys ${data.security.passkeysAvailable ? "available" : "—"}`}
              leading={<ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden />}
              onClick={() => nav.navigate("security-center")}
            />
          </MobileSection>

          <SourceNote>{data.lockedFieldsNote} {data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Profile</p>
        </>
      )}
    </MobileFrame>
  );
}
