"use client";

import { useRef, useState } from "react";
import { Save, Loader2, Check, Copy, ImageIcon, Upload, Globe, MapPin, AlertTriangle, Link as LinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateCompany } from "@/lib/supabase/db";
import { uploadCompanyLogo } from "@/lib/supabase/db-users";
import { getLuminance, adjustBrightness } from "@/lib/brand-utils";

// Get all IANA timezone names
const ALL_TIMEZONES: string[] = typeof Intl !== "undefined" && Intl.supportedValuesOf
  ? Intl.supportedValuesOf("timeZone")
  : [
      "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
      "America/Anchorage","Pacific/Honolulu","America/Phoenix","America/Indiana/Indianapolis",
      "America/Detroit","America/Kentucky/Louisville","America/Toronto","America/Vancouver",
      "Europe/London","Europe/Paris","Europe/Berlin","Europe/Moscow",
      "Asia/Tokyo","Asia/Shanghai","Asia/Kolkata","Asia/Dubai",
      "Australia/Sydney","Australia/Melbourne","Pacific/Auckland",
      "America/Sao_Paulo","America/Mexico_City","Africa/Cairo","Africa/Johannesburg",
    ];

const DEVICE_TZ = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

interface CompanyProfileSectionProps {
  companyId: string;
  initialName: string;
  initialTimezone: string;
  initialBrandColor: string;
  initialAccentColor: string;
  initialLogoUrl: string;
  initialWebsiteUrl: string;
  joinCode: string;
}

export default function CompanyProfileSection({
  companyId,
  initialName,
  initialTimezone,
  initialBrandColor,
  initialAccentColor,
  initialLogoUrl,
  initialWebsiteUrl,
  joinCode,
}: CompanyProfileSectionProps) {
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [brandColor, setBrandColor] = useState(initialBrandColor);
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tzSearch, setTzSearch] = useState("");
  const [tzOpen, setTzOpen] = useState(false);
  const tzRef = useRef<HTMLDivElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleSave() {
    if (!companyId) return;
    setSaving(true);
    try {
      await updateCompany(companyId, { name, brandColor, accentColor, timezone, logoUrl: logoUrl || undefined, websiteUrl: websiteUrl || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Settings saved");
    } catch (err) { console.error(err); toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <h3 className="text-sm font-semibold">Company Profile</h3>
          <div>
            <Label htmlFor="company-name" className="text-xs text-muted-foreground">Company Name</Label>
            <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="company-logo-url" className="text-xs text-muted-foreground">Company Logo</Label>
            <div className="flex items-center gap-2 mt-1">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-lg object-cover border border-border" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <Input id="company-logo-url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="flex-1" placeholder="https://example.com/logo.png" />
              <input
                ref={logoFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !companyId) return;
                  setUploadingLogo(true);
                  try {
                    const url = await uploadCompanyLogo(file, companyId);
                    setLogoUrl(url);
                  } catch (err) {
                    console.error("Logo upload failed:", err);
                    alert(err instanceof Error ? err.message : "Failed to upload logo");
                  } finally {
                    setUploadingLogo(false);
                    if (logoFileRef.current) logoFileRef.current.value = "";
                  }
                }}
              />
              <Button
                type="button" size="sm" variant="outline"
                className="shrink-0 gap-1.5 text-xs"
                onClick={() => logoFileRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Upload an image or paste a URL. It will appear in the sidebar.</p>
          </div>
          <div>
            <Label htmlFor="company-website-url" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <LinkIcon className="h-3 w-3" /> Company Website
            </Label>
            <Input id="company-website-url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="mt-1" placeholder="https://www.yourcompany.com" />
            <p className="text-[10px] text-muted-foreground mt-1">Your company&apos;s website. Visitors can click your badge on the landing page to visit it.</p>
          </div>
          <div ref={tzRef}>
            <Label htmlFor="company-timezone" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> Timezone
            </Label>
            <div className="relative mt-1">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Input
                    id="company-timezone"
                    value={tzOpen ? tzSearch : timezone}
                    onChange={(e) => { setTzSearch(e.target.value); setTzOpen(true); }}
                    onFocus={() => { setTzSearch(""); setTzOpen(true); }}
                    placeholder="Search timezones..."
                    className="pr-8"
                  />
                  {timezone && !tzOpen && (
                    <MapPin className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </div>
                <Button
                  type="button" size="sm" variant="outline"
                  className="shrink-0 text-[10px] gap-1"
                  onClick={() => { setTimezone(DEVICE_TZ); setTzOpen(false); }}
                  title={`Detect: ${DEVICE_TZ}`}
                >
                  <MapPin className="h-3 w-3" /> Detect
                </Button>
              </div>
              {tzOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                  {ALL_TIMEZONES
                    .filter((tz) => tz.toLowerCase().includes(tzSearch.toLowerCase()))
                    .slice(0, 50)
                    .map((tz) => (
                      <button
                        key={tz}
                        type="button"
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${tz === timezone ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
                        onClick={() => { setTimezone(tz); setTzOpen(false); setTzSearch(""); }}
                      >
                        {tz}
                      </button>
                    ))}
                  {ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(tzSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No timezones match &ldquo;{tzSearch}&rdquo;</p>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Brand Colors */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-brand-color" className="text-xs text-muted-foreground">Primary Color (dark backgrounds)</Label>
              <p className="text-[10px] text-muted-foreground/60 mb-1.5">Used for sidebar, dark surfaces. Must be a dark color.</p>
              <div className="flex items-center gap-2">
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-9 rounded-md border border-border cursor-pointer bg-transparent" />
                <Input id="company-brand-color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="flex-1 font-mono" />
                {getLuminance(brandColor) > 0.15 && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1"><AlertTriangle size={12} /> Too light</span>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="company-accent-color" className="text-xs text-muted-foreground">Accent Color (highlights &amp; buttons)</Label>
              <p className="text-[10px] text-muted-foreground/60 mb-1.5">Used for buttons, active states, badges. Should be bright/visible.</p>
              <div className="flex items-center gap-2">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-9 rounded-md border border-border cursor-pointer bg-transparent" />
                <Input id="company-accent-color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 font-mono" />
                {getLuminance(accentColor) < 0.1 && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1"><AlertTriangle size={12} /> Too dark</span>
                )}
              </div>
            </div>
            {/* Live preview card */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">Preview</div>
              <div className="flex">
                <div className="w-16 p-2 flex flex-col gap-1.5" style={{ background: brandColor }}>
                  <div className="w-full h-1.5 rounded-full opacity-30" style={{ background: "#ffffff" }} />
                  <div className="w-full h-1.5 rounded-full" style={{ background: accentColor }} />
                  <div className="w-full h-1.5 rounded-full opacity-30" style={{ background: "#ffffff" }} />
                  <div className="w-full h-1.5 rounded-full opacity-30" style={{ background: "#ffffff" }} />
                </div>
                <div className="flex-1 p-3 space-y-2" style={{ background: adjustBrightness(brandColor, 1.15) }}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full" style={{ background: accentColor }} />
                    <div className="h-2 w-24 rounded-full bg-white/20" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-6 px-3 rounded-md text-[10px] font-semibold flex items-center text-white" style={{ background: accentColor }}>Button</div>
                    <div className="h-6 px-3 rounded-md text-[10px] font-semibold flex items-center border" style={{ borderColor: accentColor, color: accentColor }}>Outline</div>
                  </div>
                  <div className="h-2 w-32 rounded-full bg-white/10" />
                  <div className="h-2 w-20 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved!" : "Save"}
          </Button>
        </CardContent>
      </Card>

      {joinCode && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="text-sm font-semibold">Join Code</h3>
            <p className="text-xs text-muted-foreground">Share this code so team members can join your organization.</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-bold tracking-widest">{joinCode}</span>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copyCode}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
