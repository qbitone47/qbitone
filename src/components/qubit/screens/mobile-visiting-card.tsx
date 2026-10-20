"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, Share2 } from "lucide-react";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  MobileCard,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  MobileStat,
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 298 · Mobile Visiting Card — the professional business
// card on mobile: QR, vCard download, copy and share. Sharing is
// recorded as an audited event and the card carries only work
// contact fields (spec §19).
// ============================================================

interface CardPayload {
  card: {
    company: string; name: string; designation: string; department: string;
    phone: string; email: string; website: string; location: string; photoInitials: string;
  };
  vcard: string;
  shareCount: number;
  sharePolicy: string;
  sourceNote: string;
}

export function MobileVisitingCardScreen() {
  const { role } = useRole();
  const { data, loading, error, reload } = useMobileSection<CardPayload>("visiting-card");
  const [busy, setBusy] = React.useState(false);

  const share = async (channel: string) => {
    setBusy(true);
    try {
      const res = await mobilePost<{ message: string }>("card.share", { channel }, role);
      toast({ title: "Share recorded", description: res.message });
      reload();
    } catch (e) {
      toast({ title: "Could not record share", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const downloadVcf = () => {
    if (!data) return;
    const blob = new Blob([data.vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.card.name.replace(/\s+/g, "-").toLowerCase()}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    share("vCard download");
  };

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(`${data.card.name} · ${data.card.designation} · ${data.card.company}\n${data.card.phone} · ${data.card.email} · ${data.card.website}`);
      toast({ title: "Contact copied" });
      share("copy");
    } catch {
      toast({ title: "Copy blocked by the browser", variant: "destructive" });
    }
  };

  const nativeShare = async () => {
    if (!data) return;
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: data.card.name, text: `${data.card.name} — ${data.card.designation}, ${data.card.company} · ${data.card.phone} · ${data.card.email}` });
        share("native share");
      } catch {
        /* user cancelled — not an error */
      }
    } else {
      copy();
    }
  };

  return (
    <MobileFrame title="Visiting Card" activeTab="profile">
      {loading && <MobileSkeleton rows={2} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          <MobileSection title="Card">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
              <div className="h-1.5 bg-gradient-to-r from-blue-600 to-slate-800" aria-hidden />
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 text-base font-bold text-white" aria-hidden>
                    {data.card.photoInitials}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold leading-tight text-slate-900">{data.card.name}</p>
                    <p className="text-[12.5px] text-slate-600">{data.card.designation} · {data.card.department}</p>
                    <p className="text-[12px] font-medium text-slate-500">{data.card.company}</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-[12.5px]">
                  <div className="flex gap-2"><dt className="w-14 shrink-0 text-slate-400">Phone</dt><dd className="truncate font-medium tabular-nums text-slate-800">{data.card.phone}</dd></div>
                  <div className="flex gap-2"><dt className="w-14 shrink-0 text-slate-400">Email</dt><dd className="truncate font-medium text-slate-800">{data.card.email}</dd></div>
                  <div className="flex gap-2"><dt className="w-14 shrink-0 text-slate-400">Web</dt><dd className="truncate font-medium text-slate-800">{data.card.website}</dd></div>
                  <div className="flex gap-2"><dt className="w-14 shrink-0 text-slate-400">Base</dt><dd className="truncate font-medium text-slate-800">{data.card.location}</dd></div>
                </dl>
              </div>
              <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                <figure role="img" aria-label="QR code encoding the work contact card" className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200">
                  <QRCodeSVG value={data.vcard} size={72} level="M" />
                </figure>
                <p className="min-w-0 text-[10.5px] leading-snug text-slate-400">
                  Scan to save the contact. The QR encodes the vCard — work fields only.
                </p>
              </div>
            </div>
          </MobileSection>

          <MobileSection title="Share">
            <div className="grid grid-cols-3 gap-2">
              <button type="button" disabled={busy} onClick={downloadVcf} className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-[11.5px] font-medium text-slate-700 hover:border-blue-300">
                <Download className="h-4 w-4 text-blue-600" aria-hidden /> vCard
              </button>
              <button type="button" disabled={busy} onClick={copy} className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-[11.5px] font-medium text-slate-700 hover:border-blue-300">
                <Copy className="h-4 w-4 text-blue-600" aria-hidden /> Copy
              </button>
              <button type="button" disabled={busy} onClick={nativeShare} className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-[11.5px] font-medium text-slate-700 hover:border-blue-300">
                <Share2 className="h-4 w-4 text-blue-600" aria-hidden /> Share
              </button>
            </div>
            <div className="flex gap-2">
              <MobileStat label="Shares recorded" value={data.shareCount} tone="blue" />
            </div>
          </MobileSection>

          <SourceNote>{data.sharePolicy} {data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Screen 298 · Mobile Visiting Card</p>
        </>
      )}
    </MobileFrame>
  );
}
