"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getCompanySettings, updateCompanySettings } from "@/lib/supabase/db-users";
import { logger } from "@/lib/logger";

export const MAX_LEAD_NOTIFY_RECIPIENTS = 5;
const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[A-Za-z]{2,24}$/;

/** Parse a comma/space separated list into valid, deduped, lowercase emails. */
export function parseNotifyEmails(input: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const e = raw.trim().toLowerCase();
    if (!e) continue;
    if (!EMAIL_RE.test(e)) invalid.push(raw.trim());
    else if (!emails.includes(e)) emails.push(e);
  }
  return { emails, invalid };
}

/**
 * Settings -> API Sources: who gets an email when a lead arrives through
 * intake-ingest. Stored in companies.settings.intakeNotifyEmails; read by the
 * edge function. Empty list = no emails.
 */
export function LeadNotifySettings({ companyId }: { companyId: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCompanySettings(companyId)
      .then((s) => {
        if (cancelled) return;
        const list = Array.isArray(s.intakeNotifyEmails) ? (s.intakeNotifyEmails as string[]) : [];
        setValue(list.join(", "));
        setSaved(list.join(", "));
      })
      .catch((e) => logger.swallow("LeadNotifySettings:load", e, "warn"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  async function handleSave() {
    const { emails, invalid } = parseNotifyEmails(value);
    if (invalid.length) {
      toast.error(`Not a valid email: ${invalid.join(", ")}`);
      return;
    }
    if (emails.length > MAX_LEAD_NOTIFY_RECIPIENTS) {
      toast.error(`Up to ${MAX_LEAD_NOTIFY_RECIPIENTS} addresses`);
      return;
    }
    setSaving(true);
    try {
      await updateCompanySettings(companyId, { intakeNotifyEmails: emails });
      setValue(emails.join(", "));
      setSaved(emails.join(", "));
      toast.success(emails.length ? "Lead notifications saved" : "Lead notifications turned off");
    } catch (e) {
      logger.swallow("LeadNotifySettings:save", e, "warn");
      toast.error("Could not save. Only owners and admins can change company settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" /> Email new leads to
          </h3>
          <p className="text-xs text-muted-foreground">
            When a lead arrives through an API key, Overwatch emails these addresses using your
            email settings (or the Overwatch sender). Leave empty for no emails. Up to {MAX_LEAD_NOTIFY_RECIPIENTS}.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="lead-notify-emails" className="text-xs">Addresses (comma separated)</Label>
          <div className="flex gap-2">
            <Input
              id="lead-notify-emails"
              type="text"
              inputMode="email"
              placeholder="contact@yourcompany.com"
              value={value}
              disabled={loading || saving}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button size="sm" onClick={handleSave} disabled={loading || saving || value === saved}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
