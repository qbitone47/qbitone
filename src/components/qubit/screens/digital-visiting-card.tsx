"use client";

import * as React from "react";
import { ArrowLeftRight, Building2, Check, Copy, Download, Globe, Mail, MapPin, Phone, Share2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { Avatar } from "../primitives";

// ============================================================
// Screen 54 · Digital Visiting Card — the professional business
// card. Source of truth is the employee profile (no duplicate
// contact database). Real utility: vCard download, copy
// contact, share link — no decorative mock QR.
// ============================================================

const COMPANY = {
  name: "Qubit One Pvt Ltd",
  tagline: "Enterprise Business Operating System",
  address: "Level 8, Prism Tower, BKC, Mumbai 400051",
  web: "qubitone.in",
};

const DIGITAL_LINK = "https://qubitone.in/u/sagar-singh";

export function DigitalVisitingCardScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const me = getEmployee("sagar")!;
  const [face, setFace] = React.useState<"front" | "back">("front");
  const [copied, setCopied] = React.useState(false);

  const vCard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:Singh;Sagar;;;`,
    `FN:${me.name}`,
    `ORG:${COMPANY.name}`,
    `TITLE:${me.title}`,
    `TEL;TYPE=WORK,VOICE:${me.phone.replace(/\s/g, "")}`,
    `EMAIL;TYPE=WORK:${me.email}`,
    `ADR;TYPE=WORK:;;${COMPANY.address};;;;India`,
    `URL:${DIGITAL_LINK}`,
    "END:VCARD",
  ].join("\r\n");

  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(vCard);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast({ title: "Contact copied", description: "A complete vCard is on your clipboard — paste into any contacts app." });
    } catch {
      toast({ variant: "destructive", title: "Clipboard unavailable", description: "Use Download vCard instead — it saves the same file." });
    }
  };

  const downloadVCard = () => {
    const blob = new Blob([vCard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Sagar-Singh-Qubit-One.vcf";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "vCard downloaded", description: "Sagar-Singh-Qubit-One.vcf — opens in Outlook, Apple Contacts and Google Contacts." });
  };

  const share = async () => {
    const shareData = { title: `${me.name} — ${COMPANY.name}`, text: `${me.name}, ${me.title} at ${COMPANY.name}`, url: DIGITAL_LINK };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(DIGITAL_LINK);
      toast({ title: "Link copied", description: `Your digital card link (${DIGITAL_LINK}) is ready to paste anywhere.` });
    } catch {
      toast({ title: "Share link", description: DIGITAL_LINK });
    }
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "People" }, { label: "Identity" }]}
        title="Digital Visiting Card"
        description="Your professional card, kept in sync with your profile — share it, save it, hand it over. One contact record, everywhere."
        actions={
          <>
            <Button variant="outline" className="h-9 gap-1.5" onClick={copyContact}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copied" : "Copy contact"}
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={downloadVCard}>
              <Download className="h-4 w-4" aria-hidden /> vCard
            </Button>
            <Button className="h-9 gap-1.5" onClick={share}>
              <Share2 className="h-4 w-4" aria-hidden /> Share
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
        {/* The card */}
        <div>
          <button
            type="button"
            onClick={() => setFace((f) => (f === "front" ? "back" : "front"))}
            aria-label={`Flip card to ${face === "front" ? "back" : "front"} side`}
            className="group relative block w-full [perspective:1200px]"
          >
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-2xl shadow-[0_20px_50px_-20px_rgba(13,27,51,0.45)] transition-transform duration-500 [transform-style:preserve-3d]",
                face === "back" && "[transform:rotateY(180deg)]",
              )}
              style={{ aspectRatio: "1.75" }}
            >
              {/* FRONT */}
              <div className="absolute inset-0 flex flex-col justify-between bg-navy-900 p-6 text-white [backface-visibility:hidden]">
                <div className="flex items-start justify-between">
                  <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 text-base font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                    Q
                  </span>
                  <span className="text-right">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-200">{COMPANY.name}</span>
                    <span className="block text-[9px] text-navy-300">{COMPANY.tagline}</span>
                  </span>
                </div>
                <div>
                  <p className="text-[22px] font-bold tracking-tight">{me.name}</p>
                  <p className="mt-0.5 text-[13px] text-blue-200">{me.title}</p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-navy-100">
                    <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3 text-blue-300" aria-hidden /> {me.email}</span>
                    <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3 text-blue-300" aria-hidden /> {me.phone}</span>
                    <span className="inline-flex items-center gap-1.5"><Globe className="h-3 w-3 text-blue-300" aria-hidden /> {COMPANY.web}</span>
                  </div>
                </div>
              </div>

              {/* BACK */}
              <div className="absolute inset-0 flex flex-col justify-between bg-white p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Digital card</p>
                  <p className="mt-1 break-all font-mono text-[11.5px] text-navy-700">{DIGITAL_LINK}</p>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">
                    Opens your live contact card — always current, sourced from your Qubit One profile. Recipients never receive stale attachments.
                  </p>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[10px] leading-relaxed text-slate-500">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-700"><MapPin className="h-3 w-3" aria-hidden /> {COMPANY.address}</p>
                    <p className="mt-0.5 flex items-center gap-1.5"><Globe className="h-3 w-3" aria-hidden /> {COMPANY.web}</p>
                  </div>
                  <Avatar name={me.name} size="md" className="rounded-lg" />
                </div>
              </div>
            </div>
          </button>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3" aria-hidden /> Tap to flip — currently showing {face === "front" ? "front" : "back"}
            </span>
            <span>Sourced live from My Profile</span>
          </div>
        </div>

        {/* Utility */}
        <div className="space-y-4">
          <div className="qubit-card p-5">
            <p className="text-sm font-semibold tracking-tight text-slate-900">Share it the professional way</p>
            <ul className="mt-3 space-y-3">
              {[
                { icon: Download, title: "Download vCard (.vcf)", body: "One file that Outlook, Apple Contacts and Google Contacts all understand — with your work details already structured.", action: downloadVCard, label: "Download" },
                { icon: Copy, title: "Copy contact to clipboard", body: "Paste into chat, mail or CRM. The vCard format keeps every field intact.", action: copyContact, label: "Copy" },
                { icon: Share2, title: "Share your live link", body: `${DIGITAL_LINK} always shows your current role and contact details — no stale PDFs.`, action: share, label: "Share" },
              ].map((u) => (
                <li key={u.title} className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3">
                  <span className="qubit-icon-tile qubit-icon-tile-accent h-9 w-9 shrink-0">{<u.icon />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-800">{u.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{u.body}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={u.action}>
                    {u.label}
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div className="qubit-card p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-900">
              <Star className="h-4 w-4 text-amber-400" aria-hidden /> One identity, everywhere
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              This card, your ID card, the Company Directory and mail signatures all read from the same employee record. Update your details in{" "}
              <button type="button" className="font-medium text-blue-600 hover:text-blue-800" onClick={() => nav.navigate("my-profile")}>
                My Profile
              </button>{" "}
              and everything updates together — no duplicate contact databases to fall out of sync.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Building2 className="h-3 w-3" aria-hidden /> External sharing shares work contact details only — never personal or HR data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
