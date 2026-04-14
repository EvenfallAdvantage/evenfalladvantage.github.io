"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "sonner";
import { Pencil, Check, X, Lock, Shield, Loader2 } from "lucide-react";
import { updateUserProfile, updateMemberProfile, getMemberProfile } from "@/lib/supabase/db";
import type { SessionUser, MemberProfile, CompFormData } from "./types";
import { WORK_PREF_OPTIONS, DIETARY_OPTIONS } from "./types";

interface Props {
  user: SessionUser | null;
  onUserChange: (user: SessionUser) => void;
  mp: MemberProfile;
  onMpChange: (mp: MemberProfile) => void;
  mpLoaded: boolean;
  activeCompanyId: string | null;
}

export function PersonalProfileCard({ user, onUserChange, mp, onMpChange, mpLoaded, activeCompanyId }: Props) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [savingComp, setSavingComp] = useState(false);
  const [compForm, setCompForm] = useState<CompFormData>({
    bio: mp?.bio ?? "", address: mp?.address ?? "",
    shirtSize: mp?.shirt_size ?? "", jacketSize: mp?.jacket_size ?? "",
    dietaryRestrictions: mp?.dietary_restrictions ?? [],
    emergencyContactName: mp?.emergency_contact_name ?? "",
    emergencyContactPhone: mp?.emergency_contact_phone ?? "",
    whatsappOptedIn: mp?.whatsapp_opted_in ?? false,
    hideContactFromRoster: mp?.hide_contact_roster ?? false,
    workPreferences: mp?.work_preferences ?? [],
  });

  // Sync compForm when mp changes externally (e.g. initial load)
  // We use a key approach via the parent to handle this, or initialize once on edit start.

  function startEdit() {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setPhone(user?.phone ?? "");
    setCompForm({
      bio: mp?.bio ?? "", address: mp?.address ?? "",
      shirtSize: mp?.shirt_size ?? "", jacketSize: mp?.jacket_size ?? "",
      dietaryRestrictions: mp?.dietary_restrictions ?? [],
      emergencyContactName: mp?.emergency_contact_name ?? "",
      emergencyContactPhone: mp?.emergency_contact_phone ?? "",
      whatsappOptedIn: mp?.whatsapp_opted_in ?? false,
      hideContactFromRoster: mp?.hide_contact_roster ?? false,
      workPreferences: mp?.work_preferences ?? [],
    });
    setEditing(true);
    setEditingCompany(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateUserProfile({ firstName, lastName, phone });
      if (user) onUserChange({ ...user, firstName, lastName, phone });
    } catch (err) { console.error("Save profile failed:", err); toast.error("Failed to save profile"); }
    finally { setSaving(false); }
  }

  async function handleSaveCompany() {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setSavingComp(true);
    try {
      await updateMemberProfile(activeCompanyId, compForm);
      onMpChange(await getMemberProfile(activeCompanyId));
    } catch (err) { console.error(err); toast.error("Failed to save company profile"); }
    finally { setSavingComp(false); }
  }

  function togglePref(pref: string) {
    setCompForm(p => ({
      ...p,
      workPreferences: p.workPreferences.includes(pref)
        ? p.workPreferences.filter(w => w !== pref)
        : [...p.workPreferences, pref],
    }));
  }

  // Guard card expiry for display mode
  const gcExpiry = mp?.guard_card_expiry ? new Date(mp.guard_card_expiry) : null;
  const gcDaysLeft = gcExpiry ? Math.ceil((gcExpiry.getTime() - Date.now()) / 86400000) : null;
  const gcExpired = gcDaysLeft !== null && gcDaysLeft < 0;
  const gcExpiringSoon = gcDaysLeft !== null && gcDaysLeft >= 0 && gcDaysLeft <= 30;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-medium">Personal Profile</CardTitle>
          <p className="text-[10px] text-muted-foreground mt-0.5">Synced across all your companies</p>
        </div>
        {!editing && !editingCompany && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {(editing || editingCompany) ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground text-xs">First name</span>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Last name</span>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs flex items-center gap-1">Email <Lock className="h-2.5 w-2.5" /></span>
              <p className="font-medium truncate text-muted-foreground">{user?.email ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Phone</span>
              <PhoneInput value={phone} onChange={setPhone} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Bio</span>
              <Input value={compForm.bio} onChange={(e) => setCompForm(p => ({ ...p, bio: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="Short bio..." />
            </div>
            <div>
              <span className="text-muted-foreground text-xs flex items-center gap-1">Address <Lock className="h-2.5 w-2.5 text-amber-500" /></span>
              <Input value={compForm.address} onChange={(e) => setCompForm(p => ({ ...p, address: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="123 Main St..." />
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Emergency Contact</span>
              <Input value={compForm.emergencyContactName} onChange={(e) => setCompForm(p => ({ ...p, emergencyContactName: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="Name" />
              <PhoneInput value={compForm.emergencyContactPhone} onChange={(v) => setCompForm(p => ({ ...p, emergencyContactPhone: v }))} className="mt-1 h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground text-xs">Shirt Size</span>
                <select value={compForm.shirtSize} onChange={(e) => setCompForm(p => ({ ...p, shirtSize: e.target.value }))}
                  className="mt-1 h-8 w-full rounded border border-border/40 bg-background px-2 text-xs">
                  <option value="">—</option>
                  {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Jacket Size</span>
                <select value={compForm.jacketSize} onChange={(e) => setCompForm(p => ({ ...p, jacketSize: e.target.value }))}
                  className="mt-1 h-8 w-full rounded border border-border/40 bg-background px-2 text-xs">
                  <option value="">—</option>
                  {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Dietary Restrictions</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {DIETARY_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setCompForm(p => ({ ...p, dietaryRestrictions: p.dietaryRestrictions.includes(opt) ? p.dietaryRestrictions.filter(d => d !== opt) : [...p.dietaryRestrictions.filter(d => d !== "None"), ...(opt === "None" ? ["None"] : [opt])] }))}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${compForm.dietaryRestrictions.includes(opt) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Work Preferences</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {WORK_PREF_OPTIONS.map(pref => (
                  <button key={pref} onClick={() => togglePref(pref)}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${compForm.workPreferences.includes(pref) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
                    {pref}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={compForm.whatsappOptedIn}
                onChange={(e) => setCompForm(p => ({ ...p, whatsappOptedIn: e.target.checked }))}
                className="rounded" />
              WhatsApp notifications opted in
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={compForm.hideContactFromRoster}
                onChange={(e) => setCompForm(p => ({ ...p, hideContactFromRoster: e.target.checked }))}
                className="rounded" />
              Hide my contact info (email &amp; phone) from company roster
            </label>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={async () => { await handleSave(); await handleSaveCompany(); setEditing(false); setEditingCompany(false); toast.success("Profile updated"); }} disabled={saving || savingComp}>
                {(saving || savingComp) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setEditing(false); setEditingCompany(false); }}>
                <X className="h-3 w-3" /> Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground text-xs">First name</span><p className="font-medium">{user?.firstName ?? "—"}</p></div>
              <div><span className="text-muted-foreground text-xs">Last name</span><p className="font-medium">{user?.lastName ?? "—"}</p></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs flex items-center gap-1">Email <Lock className="h-2.5 w-2.5" /></span>
              <p className="font-medium truncate">{user?.email ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Phone</span>
              <p className="font-medium">{user?.phone ?? "—"}</p>
            </div>
            {mp?.bio && <div><span className="text-muted-foreground text-xs">Bio</span><p className="font-medium">{mp.bio}</p></div>}
            {mpLoaded && mp && (
              <>
                <div>
                  <span className="text-muted-foreground text-xs flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Guard Card <Lock className="h-2.5 w-2.5 text-amber-500" /></span>
                  <p className="font-medium">{mp.guard_card_number ?? "—"}</p>
                  {gcExpiry && (
                    <p className={`text-[10px] ${gcExpired ? "text-red-500" : gcExpiringSoon ? "text-amber-500" : "text-muted-foreground"}`}>
                      Expires {gcExpiry.toLocaleDateString()}{gcDaysLeft !== null ? ` (${gcDaysLeft < 0 ? "expired" : `${gcDaysLeft}d`})` : ""}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground text-xs flex items-center gap-1">Address <Lock className="h-2.5 w-2.5 text-amber-500" /></span>
                  <p className="font-medium">{mp.address ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Emergency Contact</span>
                  <p className="font-medium">{mp.emergency_contact_name ?? "—"}{mp.emergency_contact_phone ? ` · ${mp.emergency_contact_phone}` : ""}</p>
                </div>
                {(mp.work_preferences?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Work Preferences</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {mp.work_preferences.map((w: string) => (
                        <Badge key={w} variant="outline" className="text-[9px]">{w}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground text-xs">Shirt</span><p className="font-medium">{mp.shirt_size ?? "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Jacket</span><p className="font-medium">{mp.jacket_size ?? "—"}</p></div>
                </div>
                {mp.dietary_restrictions?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Dietary Restrictions</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {mp.dietary_restrictions.map((d: string) => (
                        <Badge key={d} variant="outline" className="text-[9px]">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {mp.hire_date && (
                  <div><span className="text-muted-foreground text-xs">Hire Date</span><p className="font-medium">{new Date(mp.hire_date).toLocaleDateString()}</p></div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
