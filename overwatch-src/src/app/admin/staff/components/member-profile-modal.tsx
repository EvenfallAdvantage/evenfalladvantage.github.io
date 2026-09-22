"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Shield, Lock, Pencil, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMemberName, memberInitials } from "@/lib/format-names";
import { updateMemberAdminProfile } from "@/lib/supabase/db-users";
import { getMemberProfileById } from "@/lib/supabase/db-onboarding";
import { toast } from "sonner";

interface MemberProfile {
  id?: string;
  user_id?: string;
  users?: {
    id?: string;
    avatar_url?: string;
    first_name?: string;
    last_name?: string;
    callsign?: string | null;
    email?: string;
    phone?: string;
  };
  role: string;
  status: string;
  bio?: string;
  title?: string;
  guard_card_number?: string;
  guard_card_expiry?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  work_preferences?: string[];
  shirt_size?: string;
  jacket_size?: string;
  hire_date?: string;
}

interface MemberProfileModalProps {
  profile: MemberProfile;
  onClose: () => void;
  myRole?: string;
  currentUserId?: string;
  onSaved?: () => void;
}

const ROLE_RANK = { owner: 4, admin: 3, manager: 2, staff: 1 } as const;

function canEditProfile(callerRole: string | undefined, targetRole: string, isSelf: boolean): boolean {
  if (isSelf || !callerRole) return false;
  if (callerRole === "owner") return true;
  const rank = ROLE_RANK[targetRole as keyof typeof ROLE_RANK] ?? 1;
  if (callerRole === "admin") return rank < ROLE_RANK.admin;
  if (callerRole === "manager") return rank < ROLE_RANK.manager;
  return false;
}

export function MemberProfileModal({ profile, onClose, myRole, currentUserId, onSaved }: MemberProfileModalProps) {
  const [viewProfile, setViewProfile] = useState<MemberProfile>(profile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = !!viewProfile.user_id && !!currentUserId && viewProfile.user_id === currentUserId;
  const canEdit = canEditProfile(myRole, viewProfile.role, isSelf);

  // ── edit form state ──
  const [firstName, setFirstName] = useState(viewProfile.users?.first_name ?? "");
  const [lastName, setLastName] = useState(viewProfile.users?.last_name ?? "");
  const [callsign, setCallsign] = useState(viewProfile.users?.callsign ?? "");
  const [phone, setPhone] = useState(viewProfile.users?.phone ?? "");
  const [bio, setBio] = useState(viewProfile.bio ?? "");
  const [title, setTitle] = useState(viewProfile.title ?? "");
  const [address, setAddress] = useState(viewProfile.address ?? "");
  const [emergencyName, setEmergencyName] = useState(viewProfile.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(viewProfile.emergency_contact_phone ?? "");
  const [workPrefs, setWorkPrefs] = useState((viewProfile.work_preferences ?? []).join(", "));
  const [shirt, setShirt] = useState(viewProfile.shirt_size ?? "");
  const [jacket, setJacket] = useState(viewProfile.jacket_size ?? "");

  useEffect(() => {
    setViewProfile(profile);
    setFirstName(profile.users?.first_name ?? "");
    setLastName(profile.users?.last_name ?? "");
    setCallsign(profile.users?.callsign ?? "");
    setPhone(profile.users?.phone ?? "");
    setBio(profile.bio ?? "");
    setTitle(profile.title ?? "");
    setAddress(profile.address ?? "");
    setEmergencyName(profile.emergency_contact_name ?? "");
    setEmergencyPhone(profile.emergency_contact_phone ?? "");
    setWorkPrefs((profile.work_preferences ?? []).join(", "));
    setShirt(profile.shirt_size ?? "");
    setJacket(profile.jacket_size ?? "");
    setEditing(false);
    setError(null);
  }, [profile]);

  if (!viewProfile.id) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="relative w-full max-w-sm rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-muted-foreground">Unable to load member profile.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const t = (s: string) => s.trim();
      const userFields: Record<string, string | null> = {};
      if (t(firstName) !== (viewProfile.users?.first_name ?? "")) userFields.first_name = t(firstName) || null;
      if (t(lastName) !== (viewProfile.users?.last_name ?? "")) userFields.last_name = t(lastName) || null;
      if (t(callsign) !== (viewProfile.users?.callsign ?? "")) userFields.callsign = t(callsign) || null;
      if (t(phone) !== (viewProfile.users?.phone ?? "")) userFields.phone = t(phone) || null;

      const membershipFields: Record<string, string | string[] | null> = {};
      if (t(bio) !== (viewProfile.bio ?? "")) membershipFields.bio = t(bio) || null;
      if (t(title) !== (viewProfile.title ?? "")) membershipFields.title = t(title) || null;
      if (t(address) !== (viewProfile.address ?? "")) membershipFields.address = t(address) || null;
      if (t(emergencyName) !== (viewProfile.emergency_contact_name ?? "")) membershipFields.emergency_contact_name = t(emergencyName) || null;
      if (t(emergencyPhone) !== (viewProfile.emergency_contact_phone ?? "")) membershipFields.emergency_contact_phone = t(emergencyPhone) || null;
      const prefs = workPrefs.split(",").map((s) => s.trim()).filter(Boolean);
      const origPrefs = viewProfile.work_preferences ?? [];
      if (prefs.join("|") !== origPrefs.join("|")) membershipFields.work_preferences = prefs;
      if (t(shirt) !== (viewProfile.shirt_size ?? "")) membershipFields.shirt_size = t(shirt) || null;
      if (t(jacket) !== (viewProfile.jacket_size ?? "")) membershipFields.jacket_size = t(jacket) || null;

      if (Object.keys(userFields).length === 0 && Object.keys(membershipFields).length === 0) {
        setEditing(false);
        return;
      }

      await updateMemberAdminProfile(viewProfile.id!, userFields, membershipFields);
      const updated = await getMemberProfileById(viewProfile.id!);
      if (!updated) {
        setError("Profile saved but could not be refreshed");
        setSaving(false);
        return;
      }
      setViewProfile(updated);
      setFirstName(updated.users?.first_name ?? "");
      setLastName(updated.users?.last_name ?? "");
      setCallsign(updated.users?.callsign ?? "");
      setPhone(updated.users?.phone ?? "");
      setBio(updated.bio ?? "");
      setTitle(updated.title ?? "");
      setAddress(updated.address ?? "");
      setEmergencyName(updated.emergency_contact_name ?? "");
      setEmergencyPhone(updated.emergency_contact_phone ?? "");
      setWorkPrefs((updated.work_preferences ?? []).join(", "));
      setShirt(updated.shirt_size ?? "");
      setJacket(updated.jacket_size ?? "");
      setEditing(false);
      toast.success("Profile updated");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm max-h-[85vh] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4 shrink-0">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={viewProfile.users?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
              {memberInitials(viewProfile.users ?? {})}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{formatMemberName(viewProfile.users ?? {})}</p>
            <p className="text-[11px] text-muted-foreground truncate">{viewProfile.users?.email}</p>
            {viewProfile.users?.phone && !editing && <p className="text-[11px] text-muted-foreground">{viewProfile.users.phone}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className="text-[9px] capitalize">{viewProfile.role}</Badge>
            <Badge variant={viewProfile.status === "active" ? "default" : "outline"} className="text-[9px] capitalize">{viewProfile.status}</Badge>
          </div>
        </div>

        {/* Profile content */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {!editing && <h3 className="text-sm font-semibold">Company Profile</h3>}
          {editing && <h3 className="text-sm font-semibold">Edit Company Profile</h3>}

          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground text-xs">First name</span>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Last name</span>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
            </div>
          )}

          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground text-xs">Callsign</span>
                <Input value={callsign} onChange={(e) => setCallsign(e.target.value)} className="mt-1 h-8 text-sm" placeholder="e.g. Eagle" />
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Phone</span>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
            </div>
          )}

          {editField("Bio", bio, (v) => setBio(v), (value) => (
            <Textarea value={value} onChange={(e) => setBio(e.target.value)} className="mt-1 min-h-[60px] text-sm resize-none" />
          ))}

          {editField("Title", title, (v) => setTitle(v), (value) => (
            <Input value={value} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-8 text-sm" />
          ))}

          {!editing && viewProfile.users?.callsign && (
            <div>
              <span className="text-muted-foreground text-xs">Callsign</span>
              <p className="font-medium text-sm">{viewProfile.users.callsign}</p>
            </div>
          )}

          <div>
            <span className="text-muted-foreground text-xs flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Guard Card <Lock className="h-2.5 w-2.5 text-amber-500" /></span>
            <p className="font-medium text-sm">{viewProfile.guard_card_number ?? "—"}</p>
            {viewProfile.guard_card_expiry && (
              <p className="text-[10px] text-muted-foreground">
                Expires {new Date(viewProfile.guard_card_expiry).toLocaleDateString()}
              </p>
            )}
          </div>

          <hr className="border-border/30" />

          {editField("Address", address, (v) => setAddress(v), (value) => (
            <Input value={value} onChange={(e) => setAddress(e.target.value)} className="mt-1 h-8 text-sm" />
          ))}

          <div>
            <span className="text-muted-foreground text-xs">Emergency Contact</span>
            {editing ? (
              <div className="grid grid-cols-2 gap-3 mt-1">
                <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="h-8 text-sm" placeholder="Name" />
                <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="h-8 text-sm" placeholder="Phone" />
              </div>
            ) : (
              <p className="font-medium text-sm">
                {viewProfile.emergency_contact_name ?? "—"}
                {viewProfile.emergency_contact_phone ? ` · ${viewProfile.emergency_contact_phone}` : ""}
              </p>
            )}
          </div>

          <div>
            <span className="text-muted-foreground text-xs">Work Preferences</span>
            {editing ? (
              <Input value={workPrefs} onChange={(e) => setWorkPrefs(e.target.value)} className="mt-1 h-8 text-sm" placeholder="Comma-separated, e.g. Day shift, Downtown" />
            ) : (
              <div className="flex flex-wrap gap-1 mt-1">
                {(viewProfile.work_preferences?.length ?? 0) > 0 ? viewProfile.work_preferences?.map((w: string) => (
                  <Badge key={w} variant="outline" className="text-[9px]">{w}</Badge>
                )) : (
                  <p className="font-medium text-sm">—</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {editField("Shirt", shirt, (v) => setShirt(v), (value) => (
              <Input value={value} onChange={(e) => setShirt(e.target.value)} className="mt-1 h-8 text-sm" />
            ), !editing ? viewProfile.shirt_size || "—" : undefined)}
            {editField("Jacket", jacket, (v) => setJacket(v), (value) => (
              <Input value={value} onChange={(e) => setJacket(e.target.value)} className="mt-1 h-8 text-sm" />
            ), !editing ? viewProfile.jacket_size || "—" : undefined)}
          </div>

          {viewProfile.hire_date && (
            <div>
              <span className="text-muted-foreground text-xs">Hire Date</span>
              <p className="font-medium text-sm">{new Date(viewProfile.hire_date).toLocaleDateString()}</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-5 py-3 shrink-0 flex gap-2">
          {editing && canEdit ? (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(false); setError(null); }} disabled={saving}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(true); setError(null); }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              <Button size="sm" variant="outline" className={canEdit ? "" : "flex-1"} onClick={onClose}>
                <X className="h-3.5 w-3.5" /> Close
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  function editField(
    label: string,
    value: string,
    onChange: (v: string) => void,
    input: (value: string) => ReactNode,
    readValue?: string | null,
  ) {
    if (editing) {
      return (
        <div>
          <span className="text-muted-foreground text-xs">{label}</span>
          {input(value)}
        </div>
      );
    }
    return (
      <div>
        <span className="text-muted-foreground text-xs">{label}</span>
        <p className="font-medium text-sm">{readValue ?? (value || "—")}</p>
      </div>
    );
  }
}