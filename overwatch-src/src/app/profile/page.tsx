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
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "sonner";
import {
  Pencil, Check, X, FileText, Activity, FolderOpen, Loader2, Clock,
  Lock, Shield, AlertTriangle, CheckCircle2, ListChecks, Camera, Bell,
  GraduationCap, Briefcase, ChevronDown, ChevronUp, Plus, Trash2, User,
} from "lucide-react";
import { usePageHeader } from "@/stores/page-header-store";
import {
  updateUserProfile, uploadAvatar, getUserFormSubmissions, getRecentTimesheets, getUserQuizAttempts,
  getMemberProfile, updateMemberProfile, getMyOnboardingProgress, toggleOnboardingTask, completeOnboarding,
} from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";

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

interface EducationEntry {
  institution: string;
  degree: string;
  startYear: string;
  endYear: string;
}

interface WorkHistoryEntry {
  employer: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}

const EMPTY_EDU: EducationEntry = { institution: "", degree: "", startYear: "", endYear: "" };
const EMPTY_WORK: WorkHistoryEntry = { employer: "", title: "", startDate: "", endDate: "", description: "" };

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
  const isLeadership = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("PROFILE", `${user?.firstName ?? "Your"} ${user?.lastName ?? "Name"}`, <User className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader, user?.firstName, user?.lastName]);

  // Education & Work History state
  const [eduExpanded, setEduExpanded] = useState<boolean | null>(null); // null = not yet set
  const [eduEditing, setEduEditing] = useState<number | "new" | null>(null);
  const [eduForm, setEduForm] = useState<EducationEntry>(EMPTY_EDU);
  const [eduSaving, setEduSaving] = useState(false);

  const [workExpanded, setWorkExpanded] = useState<boolean | null>(null);
  const [workEditing, setWorkEditing] = useState<number | "new" | null>(null);
  const [workForm, setWorkForm] = useState<WorkHistoryEntry>(EMPTY_WORK);
  const [workSaving, setWorkSaving] = useState(false);

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
      toast.success("Avatar updated");
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
      toast.error("Avatar upload failed");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          // Default expand if entries exist
          setEduExpanded((profile.education ?? []).length > 0);
          setWorkExpanded((profile.work_history ?? []).length > 0);
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
      toast.success("Profile updated");
    } catch (err) { console.error("Save profile failed:", err); toast.error("Failed to save profile"); }
    finally { setSaving(false); }
  }

  async function handleSaveCompany() {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setSavingComp(true);
    try {
      await updateMemberProfile(activeCompanyId, compForm);
      setMp(await getMemberProfile(activeCompanyId));
      setEditingCompany(false);
      toast.success("Company profile updated");
    } catch (err) { console.error(err); toast.error("Failed to save company profile"); }
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
      toast.success("Onboarding complete!");
    } catch (err) { console.error(err); toast.error("Failed to complete onboarding"); }
  }

  function togglePref(pref: string) {
    setCompForm(p => ({
      ...p,
      workPreferences: p.workPreferences.includes(pref)
        ? p.workPreferences.filter(w => w !== pref)
        : [...p.workPreferences, pref],
    }));
  }

  // ─── Education CRUD ───────────────────────────────────
  async function saveEducationEntry() {
    if (!mp?.id || !eduForm.institution.trim()) return;
    setEduSaving(true);
    try {
      const current: EducationEntry[] = mp.education ?? [];
      let updated: EducationEntry[];
      if (eduEditing === "new") {
        updated = [...current, { ...eduForm }];
      } else if (typeof eduEditing === "number") {
        updated = current.map((e: EducationEntry, i: number) => i === eduEditing ? { ...eduForm } : e);
      } else {
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from("company_memberships").update({ education: updated }).eq("id", mp.id);
      if (error) throw error;
      setMp({ ...mp, education: updated });
      setEduEditing(null);
      setEduForm(EMPTY_EDU);
      toast.success("Education updated");
    } catch (err) { console.error(err); toast.error("Failed to save education"); }
    finally { setEduSaving(false); }
  }

  async function deleteEducationEntry(idx: number) {
    if (!mp?.id) return;
    const current: EducationEntry[] = mp.education ?? [];
    const updated = current.filter((_: EducationEntry, i: number) => i !== idx);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("company_memberships").update({ education: updated }).eq("id", mp.id);
      if (error) throw error;
      setMp({ ...mp, education: updated });
      toast.success("Education entry removed");
    } catch (err) { console.error(err); toast.error("Failed to delete education entry"); }
  }

  // ─── Work History CRUD ────────────────────────────────
  async function saveWorkHistoryEntry() {
    if (!mp?.id || !workForm.employer.trim()) return;
    setWorkSaving(true);
    try {
      const current: WorkHistoryEntry[] = mp.work_history ?? [];
      let updated: WorkHistoryEntry[];
      if (workEditing === "new") {
        updated = [...current, { ...workForm }];
      } else if (typeof workEditing === "number") {
        updated = current.map((e: WorkHistoryEntry, i: number) => i === workEditing ? { ...workForm } : e);
      } else {
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from("company_memberships").update({ work_history: updated }).eq("id", mp.id);
      if (error) throw error;
      setMp({ ...mp, work_history: updated });
      setWorkEditing(null);
      setWorkForm(EMPTY_WORK);
      toast.success("Work history updated");
    } catch (err) { console.error(err); toast.error("Failed to save work history"); }
    finally { setWorkSaving(false); }
  }

  async function deleteWorkHistoryEntry(idx: number) {
    if (!mp?.id) return;
    const current: WorkHistoryEntry[] = mp.work_history ?? [];
    const updated = current.filter((_: WorkHistoryEntry, i: number) => i !== idx);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("company_memberships").update({ work_history: updated }).eq("id", mp.id);
      if (error) throw error;
      setMp({ ...mp, work_history: updated });
      toast.success("Work history entry removed");
    } catch (err) { console.error(err); toast.error("Failed to delete work history entry"); }
  }

  const loadSubmissions = useCallback(async () => {
    if (tabLoaded.submissions) return;
    try { setSubmissions(await getUserFormSubmissions(activeCompanyId ?? undefined)); } catch {}
    setTabLoaded((p) => ({ ...p, submissions: true }));
  }, [tabLoaded.submissions, activeCompanyId]);

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
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs capitalize">
              {activeCompany?.role ?? "Staff"}
            </Badge>
            {isOnboarding && <Badge className="text-[10px] bg-amber-500/15 text-amber-600">Onboarding</Badge>}
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

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Sidebar: Personal + Company Details */}
          <div className="space-y-4">
            {/* Personal Profile (combined) */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Personal Profile</CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Synced across all your companies</p>
                </div>
                {!editing && !editingCompany && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { startEdit(); setEditingCompany(true); }}>
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
                      <Button size="sm" className="h-7 gap-1 text-xs" onClick={async () => { await handleSave(); await handleSaveCompany(); }} disabled={saving || savingComp}>
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
                        } catch (err) { console.warn("Toggle mute failed:", err); }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${mp.notifications_muted ? "bg-destructive" : "bg-muted"}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${mp.notifications_muted ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <span className="text-xs">Share location while on shift</span>
                      <p className="text-[10px] text-muted-foreground">Your GPS position will be visible to your team on the tactical map when you&apos;re clocked in.</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!activeCompanyId || activeCompanyId === "pending") return;
                        const next = !(mp.location_sharing ?? true);
                        try {
                          await updateMemberProfile(activeCompanyId, { locationSharing: next });
                          setMp({ ...mp, location_sharing: next });
                        } catch (err) { console.warn("Toggle location sharing failed:", err); }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${(mp.location_sharing ?? true) ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${(mp.location_sharing ?? true) ? "translate-x-4" : "translate-x-0"}`} />
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
                              } catch (err) { console.warn("Update notification days failed:", err); }
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

            {/* Education */}
            {mpLoaded && mp && (
              <Card>
                <CardHeader className="pb-2">
                  <button
                    onClick={() => setEduExpanded(prev => !prev)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5" /> Education
                      {(mp.education ?? []).length > 0 && (
                        <Badge variant="secondary" className="text-[9px] ml-1">{(mp.education ?? []).length}</Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {eduEditing === null && (
                        <Button
                          variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1"
                          onClick={(e) => { e.stopPropagation(); setEduExpanded(true); setEduEditing("new"); setEduForm(EMPTY_EDU); }}
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      )}
                      {eduExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                </CardHeader>
                {eduExpanded && (
                  <CardContent className="space-y-2 pt-0">
                    {(mp.education ?? []).map((entry: EducationEntry, idx: number) => (
                      eduEditing === idx ? (
                        <div key={idx} className="space-y-2 rounded-lg border border-border/40 p-3">
                          <Input placeholder="Institution" value={eduForm.institution} onChange={(e) => setEduForm(p => ({ ...p, institution: e.target.value }))} className="h-8 text-sm" />
                          <Input placeholder="Degree / Program" value={eduForm.degree} onChange={(e) => setEduForm(p => ({ ...p, degree: e.target.value }))} className="h-8 text-sm" />
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Start Year" value={eduForm.startYear} onChange={(e) => setEduForm(p => ({ ...p, startYear: e.target.value }))} className="h-8 text-sm" />
                            <Input placeholder="End Year" value={eduForm.endYear} onChange={(e) => setEduForm(p => ({ ...p, endYear: e.target.value }))} className="h-8 text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveEducationEntry} disabled={eduSaving}>
                              {eduSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setEduEditing(null); setEduForm(EMPTY_EDU); }}>
                              <X className="h-3 w-3" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div key={idx} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{entry.institution}{entry.degree ? ` — ${entry.degree}` : ""}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {entry.startYear}{entry.endYear ? ` - ${entry.endYear}` : ""}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEduEditing(idx); setEduForm(entry); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteEducationEntry(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    ))}
                    {eduEditing === "new" && (
                      <div className="space-y-2 rounded-lg border border-border/40 p-3">
                        <Input placeholder="Institution" value={eduForm.institution} onChange={(e) => setEduForm(p => ({ ...p, institution: e.target.value }))} className="h-8 text-sm" />
                        <Input placeholder="Degree / Program" value={eduForm.degree} onChange={(e) => setEduForm(p => ({ ...p, degree: e.target.value }))} className="h-8 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Start Year" value={eduForm.startYear} onChange={(e) => setEduForm(p => ({ ...p, startYear: e.target.value }))} className="h-8 text-sm" />
                          <Input placeholder="End Year" value={eduForm.endYear} onChange={(e) => setEduForm(p => ({ ...p, endYear: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveEducationEntry} disabled={eduSaving}>
                            {eduSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setEduEditing(null); setEduForm(EMPTY_EDU); }}>
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {(mp.education ?? []).length === 0 && eduEditing === null && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No education entries yet.</p>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            {/* Work History */}
            {mpLoaded && mp && (
              <Card>
                <CardHeader className="pb-2">
                  <button
                    onClick={() => setWorkExpanded(prev => !prev)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" /> Work History
                      {(mp.work_history ?? []).length > 0 && (
                        <Badge variant="secondary" className="text-[9px] ml-1">{(mp.work_history ?? []).length}</Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {workEditing === null && (
                        <Button
                          variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1"
                          onClick={(e) => { e.stopPropagation(); setWorkExpanded(true); setWorkEditing("new"); setWorkForm(EMPTY_WORK); }}
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      )}
                      {workExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                </CardHeader>
                {workExpanded && (
                  <CardContent className="space-y-2 pt-0">
                    {(mp.work_history ?? []).map((entry: WorkHistoryEntry, idx: number) => (
                      workEditing === idx ? (
                        <div key={idx} className="space-y-2 rounded-lg border border-border/40 p-3">
                          <Input placeholder="Employer" value={workForm.employer} onChange={(e) => setWorkForm(p => ({ ...p, employer: e.target.value }))} className="h-8 text-sm" />
                          <Input placeholder="Job Title" value={workForm.title} onChange={(e) => setWorkForm(p => ({ ...p, title: e.target.value }))} className="h-8 text-sm" />
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="month" placeholder="Start Date" value={workForm.startDate} onChange={(e) => setWorkForm(p => ({ ...p, startDate: e.target.value }))} className="h-8 text-sm" />
                            <Input type="month" placeholder="End Date" value={workForm.endDate} onChange={(e) => setWorkForm(p => ({ ...p, endDate: e.target.value }))} className="h-8 text-sm" />
                          </div>
                          <Input placeholder="Description" value={workForm.description} onChange={(e) => setWorkForm(p => ({ ...p, description: e.target.value }))} className="h-8 text-sm" />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveWorkHistoryEntry} disabled={workSaving}>
                              {workSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setWorkEditing(null); setWorkForm(EMPTY_WORK); }}>
                              <X className="h-3 w-3" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div key={idx} className="flex items-start gap-3 rounded-lg border border-border/40 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{entry.title}{entry.employer ? ` at ${entry.employer}` : ""}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {entry.startDate}{entry.endDate ? ` - ${entry.endDate}` : " - Present"}
                            </p>
                            {entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => { setWorkEditing(idx); setWorkForm(entry); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive shrink-0" onClick={() => deleteWorkHistoryEntry(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    ))}
                    {workEditing === "new" && (
                      <div className="space-y-2 rounded-lg border border-border/40 p-3">
                        <Input placeholder="Employer" value={workForm.employer} onChange={(e) => setWorkForm(p => ({ ...p, employer: e.target.value }))} className="h-8 text-sm" />
                        <Input placeholder="Job Title" value={workForm.title} onChange={(e) => setWorkForm(p => ({ ...p, title: e.target.value }))} className="h-8 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="month" placeholder="Start Date" value={workForm.startDate} onChange={(e) => setWorkForm(p => ({ ...p, startDate: e.target.value }))} className="h-8 text-sm" />
                          <Input type="month" placeholder="End Date" value={workForm.endDate} onChange={(e) => setWorkForm(p => ({ ...p, endDate: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <Input placeholder="Description" value={workForm.description} onChange={(e) => setWorkForm(p => ({ ...p, description: e.target.value }))} className="h-8 text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveWorkHistoryEntry} disabled={workSaving}>
                            {workSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setWorkEditing(null); setWorkForm(EMPTY_WORK); }}>
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {(mp.work_history ?? []).length === 0 && workEditing === null && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No work history entries yet.</p>
                    )}
                  </CardContent>
                )}
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
