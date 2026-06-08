"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Shield, AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPublicReportLinkBySlug,
  submitPublicReport,
  type PublicReportLink,
} from "@/lib/supabase/db-public-reports";

function PublicReportFormInner() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("l") ?? "";

  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(
    slug ? null : "No report link provided. Ask the operator for a current QR code.",
  );
  const [link, setLink] = useState<PublicReportLink | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [body, setBody] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void getPublicReportLinkBySlug(slug)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError("This report link is invalid or no longer active.");
        } else {
          setLink(result);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsBusy(false);
      },
      () => {
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  async function handleSubmit() {
    if (!link || !body.trim()) return;
    setSubmitting(true);
    try {
      await submitPublicReport(link.id, link.companyId, {
        body: body.trim(),
        reporterName: reporterName.trim() || undefined,
        reporterPhone: reporterPhone.trim() || undefined,
        reporterEmail: reporterEmail.trim() || undefined,
        location: location.trim() || undefined,
        locationLat: coords?.lat,
        locationLng: coords?.lng,
      });
      setSubmitted(true);
    } catch (e) {
      console.error("[public-report] submit failed", e);
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Shield className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h1 className="text-lg font-semibold mb-2">Report Link Unavailable</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Report received</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Thank you. Our team has been notified and will follow up if needed.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mb-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold">{link.label}</h1>
          <p className="text-xs text-muted-foreground">
            Submit a confidential report. The operator will receive it immediately.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <label htmlFor="report-body" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              What happened? <span className="text-red-500">*</span>
            </label>
            <textarea
              id="report-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the situation, location, time, and any details that may help."
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="report-location" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              Location (optional)
            </label>
            <Input
              id="report-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Building, floor, room, landmark..."
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
              <span>
                {coords
                  ? `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : "Add GPS coordinates from your device (optional)"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={useMyLocation}
                disabled={gpsBusy}
                className="h-7 text-[11px]"
              >
                {gpsBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Use my location"}
              </Button>
            </div>
          </div>

          <div className="border-t border-border/50 pt-3 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Optional contact info (so we can follow up)
            </p>
            <Input
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="Your name (optional)"
              aria-label="Reporter name"
            />
            <Input
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              placeholder="Phone (optional)"
              type="tel"
              aria-label="Reporter phone"
            />
            <Input
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value)}
              placeholder="Email (optional)"
              type="email"
              aria-label="Reporter email"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !body.trim()}
            className="w-full gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit report
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground/70">
          Powered by Overwatch. Submissions are encrypted in transit.
        </p>
      </div>
    </div>
  );
}

export default function PublicReportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <PublicReportFormInner />
    </Suspense>
  );
}
