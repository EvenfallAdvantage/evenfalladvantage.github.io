"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pencil, Check, X, FileText, Activity, FolderOpen, Loader2, Clock,
  Lock, Shield, AlertTriangle, CheckCircle2, ListChecks, Camera, Copy, KeyRound, Bell,
} from "lucide-react";
import {
  updateUserProfile, uploadAvatar, getCompanyDetails, getUserFormSubmissions, getRecentTimesheets, getUserQuizAttempts,
  getMemberProfile, updateMemberProfile, getMyOnboardingProgress, toggleOnboardingTask, completeOnboarding,
} from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sub = any;
import { parseUTC } from "@/lib/parse-utc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Attempt = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MemberProfile = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OProgress = any;

const WORK_PREF_OPTIONS = ["Weekdays", "Weekends", "Nights", "Mornings", "Events", "Overtime", "Holidays"];
const DIETARY_OPTIONS = [
  "None", "Vegetarian", "Vegan", "Pescatarian", "Gluten-Free", "Dairy-Free",
  "Nut Allergy", "Shellfish Allergy", "Soy Allergy", "Egg Allergy",
  "Kosher", "Halal", "Keto", "Paleo", "Low Sodium", "Diabetic-Friendly",
  "Lactose Intolerant", "No Pork", "No Beef", "No Red Meat", "Other",
];

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<Sub[]>([]);
  const [timesheets, setTimesheets] = useState<Sheet[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<Attempt[]>([]);
  const [tabLoaded, setTabLoaded] = useState<Record<string, boolean>>({});
  // Enhanced profile
  const [mp, setMp] = useState<MemberProfile>(null);
  const [mpLoaded, setMpLoaded] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [compForm, setCompForm] = useState({ bio: "", address: "", shirtSize: "", jacketSize: "", dietaryRestrictions: [] as string[], emergencyContactName: "", emergencyContactPhone: "", whatsappOptedIn: false, hideContactFromRoster: false, workPreferences: [] as string[] });
  const [savingComp, setSavingComp] = useState(false);
  // Onboarding
  const [onboardingProgress, setOnboardingProgress] = useState<OProgress[]>([]);
  const [togglingTask, setTogglingTask] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const isLeadership = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      if (user) setUser({ ...user, avatarUrl: url });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Load company join code (leadership only)
  useEffect(() => {
    if (!activeCompanyId || activeCompanyId === "pending" || !isLeadership) return;
    (async () => {
      try {
        const company = await getCompanyDetails(activeCompanyId);
        setJoinCode(company?.join_code ?? "");
      } catch {}
    })();
  }, [activeCompanyId, isLeadership]);

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Load member profile + onboarding progress
  useEffect(() => {
    if (!activeCompanyId || activeCompanyId === "pending" || mpLoaded) return;
    (async () => {
      try {
        const profile = await getMemberProfile(activeCompanyId);
        setMp(profile);
        if (profile) {
          setCompForm({
            bio: profile.bio ?? "", address: profile.address ?? "",
            shirtSize: profile.shirt_size ?? "", jacketSize: profile.jacket_size ?? "",
            dietaryRestrictions: profile.dietary_restrictions ?? [],
            emergencyContactName: profile.emergency_contact_name ?? "",
            emergencyContactPhone: profile.emergency_contact_phone ?? "",
            whatsappOptedIn: profile.whatsapp_opted_in ?? false,
            hideContactFromRoster: profile.hide_contact_roster ?? false,
            workPreferences: profile.work_preferences ?? [],
          });
        }
      } catch {}
      try { setOnboardingProgress(await getMyOnboardingProgress(activeCompanyId)); } catch {}
      setMpLoaded(true);
    })();
  }, [activeCompanyId, mpLoaded]);

  // Profile completeness calculation
  const completenessFields = [
    !!user?.firstName, !!user?.lastName, !!user?.email, !!user?.phone,
    !!mp?.bio, !!mp?.address, !!mp?.guard_card_number, !!mp?.emergency_contact_name,
    !!mp?.emergency_contact_phone, (mp?.work_preferences?.length ?? 0) > 0,
  ];
  const completeness = Math.round((completenessFields.filter(Boolean).length / completenessFields.length) * 100);

  // Guard card expiry
  const gcExpiry = mp?.guard_card_expiry ? new Date(mp.guard_card_expiry) : null;
  const gcDaysLeft = gcExpiry ? Math.ceil((gcExpiry.getTime() - Date.now()) / 86400000) : null;
  const gcExpired = gcDaysLeft !== null && gcDaysLeft < 0;
  const gcExpiringSoon = gcDaysLeft !== null && gcDaysLeft >= 0 && gcDaysLeft <= 30;

  // Onboarding status
  const isOnboarding = mp?.status === "onboarding" && !mp?.onboarding_complete;
  const requiredTasks = onboardingProgress.filter((p: OProgress) => p.onboarding_tasks?.is_required);
  const completedRequired = requiredTasks.filter((p: OProgress) => p.completed);
  const allRequiredDone = requiredTasks.length > 0 && completedRequired.length === requiredTasks.length;

  function startEdit() {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setPhone(user?.phone ?? "");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateUserProfile({ firstName, lastName, phone });
      if (user) setUser({ ...user, firstName, lastName, phone });
      setEditing(false);
    } catch (err) { console.error("Save profile failed:", err); }
    finally { setSaving(false); }
  }

  async function handleSaveCompany() {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setSavingComp(true);
    try {
      await updateMemberProfile(activeCompanyId, compForm);
      setMp(await getMemberProfile(activeCompanyId));
      setEditingCompany(false);
    } catch (err) { console.error(err); }
    finally { setSavingComp(false); }
  }

  async function handleToggleOnboarding(taskId: string, completed: boolean) {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setTogglingTask(taskId);
    try {
      await toggleOnboardingTask(taskId, completed);
      setOnboardingProgress(await getMyOnboardingProgress(activeCompanyId));
    } catch (err) { console.error(err); }
    finally { setTogglingTask(null); }
  }

  async function handleCompleteOnboarding() {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      await completeOnboarding(activeCompanyId);
      setMp(await getMemberProfile(activeCompanyId));
    } catch (err) { console.error(err); }
  }

  function togglePref(pref: string) {
    setCompForm(p => ({
      ...p,
      workPreferences: p.workPreferences.includes(pref)
        ? p.workPreferences.filter(w => w !== pref)
        : [...p.workPreferences, pref],
    }));
  }

  const loadSubmissions = useCallback(async () => {
    if (tabLoaded.submissions) return;
    try { setSubmissions(await getUserFormSubmissions()); } catch {}
    setTabLoaded((p) => ({ ...p, submissions: true }));
  }, [tabLoaded.submissions]);

  const loadActivity = useCallback(async () => {
    if (tabLoaded.activity) return;
    try {
      const [ts, qa] = await Promise.all([getRecentTimesheets(10), getUserQuizAttempts()]);
      setTimesheets(ts.filter((t: Sheet) => t.clock_out));
      setQuizAttempts(qa);
    } catch {}
    setTabLoaded((p) => ({ ...p, activity: true }));
  }, [tabLoaded.activity]);

  function onTabChange(val: string) {
    if (val === "submissions") loadSubmissions();
    if (val === "activity") loadActivity();
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <AvatarImage src={user?.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-lg font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
              {avatarError && <p className="absolute -bottom-5 left-0 text-[10px] text-red-500 whitespace-nowrap">{avatarError}</p>}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">
                {user?.firstName ?? "Your"} {user?.lastName ?? "Name"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs capitalize">
                  {activeCompany?.role ?? "Staff"}
                </Badge>
                {isOnboarding && <Badge className="text-[10px] bg-amber-500/15 text-amber-600">Onboarding</Badge>}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Completeness */}
        {mpLoaded && (
          <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">Profile Completeness</span>
              <span className={`text-xs font-bold ${completeness === 100 ? "text-green-500" : completeness >= 70 ? "text-amber-500" : "text-red-500"}`}>{completeness}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${completeness === 100 ? "bg-green-500" : completeness >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${completeness}%` }} />
            </div>
            {completeness < 100 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Complete your profile to help your team identify you. Missing: {completenessFields.map((v, i) => !v ? ["first name", "last name", "email", "phone", "bio", "address", "guard card", "emergency name", "emergency phone", "work preferences"][i] : null).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Guard Card Warning */}
        {(gcExpired || gcExpiringSoon) && (
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${gcExpired ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            <AlertTriangle className={`h-5 w-5 shrink-0 ${gcExpired ? "text-red-500" : "text-amber-500"}`} />
            <div>
              <p className={`text-sm font-medium ${gcExpired ? "text-red-500" : "text-amber-600"}`}>
                {gcExpired ? "Guard Card Expired" : `Guard Card Expires in ${gcDaysLeft} Days`}
              </p>
              <p className="text-xs text-muted-foreground">
                {gcExpired ? "Your guard card has expired. Contact your admin to update." : "Renew your guard card before it expires."}
              </p>
            </div>
          </div>
        )}

        {/* Onboarding Checklist */}
        {isOnboarding && onboardingProgress.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ListChecks className="h-4 w-4" /> Onboarding Checklist
                <Badge className="ml-auto text-[10px] bg-primary/15 text-primary">{completedRequired.length}/{requiredTasks.length} required</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {onboardingProgress.map((p: OProgress) => {
                const task = p.onboarding_tasks;
                if (!task) return null;
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
                    <button onClick={() => handleToggleOnboarding(p.task_id, !p.completed)}
                      disabled={togglingTask === p.task_id}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${p.completed ? "bg-green-500 border-green-500 text-white" : "border-border/60 hover:border-primary"}`}>
                      {togglingTask === p.task_id ? <Loader2 className="h-3 w-3 animate-spin" /> : p.completed ? <Check className="h-3 w-3" /> : null}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${p.completed ? "line-through text-muted-foreground" : "font-medium"}`}>{task.title}</p>
                      {task.description && <p className="text-[10px] text-muted-foreground">{task.description}</p>}
                    </div>
                    {task.is_required && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Required</Badge>}
                    <Badge variant="outline" className="text-[9px] capitalize">{task.category}</Badge>
                  </div>
                );
              })}
              {allRequiredDone && (
                <Button size="sm" className="w-full mt-2 gap-1.5" onClick={handleCompleteOnboarding}>
                  <CheckCircle2 className="h-4 w-4" /> Complete Onboarding
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Team Join Code — leadership only */}
        {joinCode && isLeadership && (
          <Card className="border-border/40">
            <CardContent className="space-y-4 pt-6 pb-6">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Join Code</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-5 py-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Share this code to invite team members</p>
                  <p className="text-2xl font-mono font-bold tracking-[0.3em] text-amber-500">{joinCode}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copyCode}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Sidebar: Personal + Company Details */}
          <div className="space-y-4">
            {/* Personal Details */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Personal Details</CardTitle>
                {!editing && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {editing ? (
                  <>
                    <div>
                      <span className="text-muted-foreground text-xs">First name</span>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Last name</span>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs flex items-center gap-1">Email <Lock className="h-2.5 w-2.5" /></span>
                      <p className="font-medium truncate text-muted-foreground">{user?.email ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Phone</span>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-8 text-sm" placeholder="(555) 123-4567" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditing(false)}>
                        <X className="h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-muted-foreground text-xs">First name</span>
                      <p className="font-medium">{user?.firstName ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Last name</span>
                      <p className="font-medium">{user?.lastName ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs flex items-center gap-1">Email <Lock className="h-2.5 w-2.5" /></span>
                      <p className="font-medium truncate">{user?.email ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Phone</span>
                      <p className="font-medium">{user?.phone ?? "—"}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Company Profile */}
            {mpLoaded && mp && (
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">Company Profile</CardTitle>
                  {!editingCompany && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingCompany(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {editingCompany ? (
                    <>
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
                        <Input value={compForm.emergencyContactPhone} onChange={(e) => setCompForm(p => ({ ...p, emergencyContactPhone: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="Phone" />
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
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSaveCompany} disabled={savingComp}>
                          {savingComp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditingCompany(false)}>
                          <X className="h-3 w-3" /> Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {mp.bio && <div><span className="text-muted-foreground text-xs">Bio</span><p className="font-medium">{mp.bio}</p></div>}
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
                </CardContent>
              </Card>
            )}

            {/* Notification Preferences */}
            {mpLoaded && mp && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5" /> Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <label className="flex items-center justify-between">
                    <span className="text-xs">Mute all notifications</span>
                    <button
                      onClick={async () => {
                        if (!activeCompanyId || activeCompanyId === "pending") return;
                        const next = !mp.notifications_muted;
                        try {
                          await updateMemberProfile(activeCompanyId, { notificationsMuted: next });
                          setMp({ ...mp, notifications_muted: next });
                        } catch {}
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${mp.notifications_muted ? "bg-destructive" : "bg-muted"}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${mp.notifications_muted ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </label>
                  <div>
                    <span className="text-xs text-muted-foreground">Notification days</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                        const active = (mp.notification_days ?? []).includes(day);
                        return (
                          <button
                            key={day}
                            onClick={async () => {
                              if (!activeCompanyId || activeCompanyId === "pending") return;
                              const next = active
                                ? (mp.notification_days ?? []).filter((d: string) => d !== day)
                                : [...(mp.notification_days ?? []), day];
                              try {
                                await updateMemberProfile(activeCompanyId, { notificationDays: next });
                                setMp({ ...mp, notification_days: next });
                              } catch {}
                            }}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">You&apos;ll only receive push/email notifications on selected days.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="shared" onValueChange={onTabChange}>
            <TabsList>
              <TabsTrigger value="shared" className="gap-1.5 text-xs">
                <FolderOpen className="h-3.5 w-3.5" />
                Shared with me
              </TabsTrigger>
              <TabsTrigger value="submissions" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                My submissions
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />
                My activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shared">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No entries to display</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Shared entries will be displayed here. Your teammates may share
                    Forms and checklists entries with you.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="submissions">
              <Card>
                <CardContent className="py-4">
                  {!tabLoaded.submissions ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : submissions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No submissions yet</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Forms you submit will appear here for tracking.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {submissions.map((s: Sub) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                          <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.forms?.name ?? "Form"}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] capitalize">{s.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardContent className="py-4">
                  {!tabLoaded.activity ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : timesheets.length === 0 && quizAttempts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Activity className="mb-3 h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No activity yet</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Your clock-ins, training progress, and other activity will show here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {timesheets.map((t: Sheet) => {
                        const hrs = ((parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000).toFixed(1);
                        return (
                          <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                            <Clock className="h-4 w-4 text-green-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Shift — {hrs}h</p>
                              <p className="text-[10px] text-muted-foreground">{parseUTC(t.clock_in).toLocaleDateString()}</p>
                            </div>
                            <Badge variant={t.approved ? "default" : "secondary"} className="text-[10px]">
                              {t.approved ? "Approved" : "Pending"}
                            </Badge>
                          </div>
                        );
                      })}
                      {quizAttempts.map((a: Attempt) => (
                        <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                          <Activity className="h-4 w-4 text-amber-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Drill: {a.quizzes?.title ?? "Quiz"}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(a.started_at).toLocaleDateString()}</p>
                          </div>
                          <Badge className={`text-[10px] ${a.passed ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
                            {a.score}% — {a.passed ? "Passed" : "Failed"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
