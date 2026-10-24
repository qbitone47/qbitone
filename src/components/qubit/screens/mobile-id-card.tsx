"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck } from "lucide-react";
import {
  MobileCard,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  SourceNote,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 297 · Mobile ID Card — the digital employee ID card.
// Company-branded, minimum identity fields only (spec §18): the QR
// encodes a signed verification reference that checks against the
// employee registry without exposing unrestricted data.
// ============================================================

interface IdCardPayload {
  card: {
    company: string; name: string; employeeId: string; designation: string;
    department: string; location: string; status: string; photoInitials: string;
  };
  validity: string;
  verification: { payload: string; note: string };
  minimizeNote: string;
  sourceNote: string;
}

export function MobileIdCardScreen() {
  const { data, loading, error, reload } = useMobileSection<IdCardPayload>("id-card");

  return (
    <MobileFrame title="ID Card" activeTab="profile">
      {loading && <MobileSkeleton rows={2} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          <MobileSection title="Employee identity">
            {/* The card */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 text-[13px] font-bold text-white">Q</span>
                  <span>
                    <span className="block text-[12.5px] font-semibold leading-tight text-white">{data.card.company}</span>
                    <span className="block text-[9.5px] leading-tight text-slate-300">Employee identity credential</span>
                  </span>
                </span>
                <BadgeCheck className="h-5 w-5 text-emerald-400" aria-label="Verified" />
              </div>
              <div className="flex gap-4 p-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-2xl font-bold text-white" aria-hidden>
                    {data.card.photoInitials}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Photo</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-tight text-slate-900">{data.card.name}</p>
                  <p className="text-[12.5px] text-slate-600">{data.card.designation}</p>
                  <p className="text-[12px] text-slate-500">{data.card.department}</p>
                  <dl className="mt-2.5 space-y-1 text-[11.5px]">
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Employee ID</dt><dd className="font-semibold tabular-nums text-slate-800">{data.card.employeeId}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Location</dt><dd className="font-medium text-slate-700">{data.card.location}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Status</dt><dd className="font-medium text-emerald-700">{data.card.status}</dd></div>
                  </dl>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                <figure role="img" aria-label="Verification QR — encodes a signed reference that checks against the employee registry" className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200">
                  <QRCodeSVG value={`qubitone://verify/employee/${data.card.employeeId}/${data.verification.payload}`} size={72} level="M" />
                </figure>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold text-slate-800">{data.validity}</p>
                  <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-400" title={data.verification.payload}>REF {data.verification.payload}</p>
                  <p className="mt-1 text-[10.5px] leading-snug text-slate-400">Scan to verify against the registry — no personal data is encoded beyond the reference.</p>
                </div>
              </div>
            </div>
          </MobileSection>

          <MobileSection title="Data minimization">
            <MobileCard className="border-slate-200 bg-slate-50/60">
              <p className="text-[12px] leading-relaxed text-slate-600">{data.minimizeNote}</p>
            </MobileCard>
          </MobileSection>

          <SourceNote>{data.verification.note} {data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile ID Card</p>
        </>
      )}
    </MobileFrame>
  );
}
