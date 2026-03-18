"use client";

import { useEffect, useState, useCallback } from "react";
import { timeAgo } from "@/lib/utils";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import {
  AlertTriangle,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  User,
  MessageSquare,
  Send,
  Shield,
  Flame,
  CircleDot,
  CheckCircle2,
  Loader2,
  Trash2,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import {
  getIncidents,
  createIncident,
  updateIncident,
  getIncidentUpdates,
  addIncidentUpdate,
  deleteIncident,
  getCompanyMembers,
} from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Incident = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IncidentUpdate = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

const SEVERITY = [
  { value: "critical", label: "Critical", color: "bg-red-600 text-white", icon: Flame },
  { value: "high", label: "High", color: "bg-orange-500 text-white", icon: AlertTriangle },
  { value: "medium", label: "Medium", color: "bg-amber-500 text-white", icon: Shield },
  { value: "low", label: "Low", color: "bg-blue-500 text-white", icon: CircleDot },
];

const STATUS = [
  { value: "open", label: "Open", color: "bg-red-500/15 text-red-600" },
  { value: "investigating", label: "Investigating", color: "bg-amber-500/15 text-amber-600" },
  { value: "resolved", label: "Resolved", color: "bg-green-500/15 text-green-600" },
  { value: "closed", label: "Closed", color: "bg-muted text-muted-foreground" },
];

const TYPES = [
  "general", "trespass", "theft", "vandalism", "assault",
  "suspicious_activity", "medical", "fire", "alarm",
  "access_control", "policy_violation", "workplace_violence",
  "drug_alcohol", "harassment", "missing_person", "vehicle_incident",
  "water_leak", "power_outage", "elevator_entrapment", "slip_trip_fall", "other",
];

const WEATHER_OPTIONS = ["Clear", "Cloudy", "Rain", "Snow", "Fog", "Windy", "Extreme Heat", "Extreme Cold", "N/A — Indoors"];
const LIGHTING_OPTIONS = ["Well-lit", "Dim / Partial", "Dark / No Lighting", "Strobe / Flickering", "Natural Daylight"];
const SERVICES_OPTIONS = ["Police / Law Enforcement", "Fire Department", "EMS / Ambulance", "Building Maintenance", "Management / Supervisor", "K-9 Unit", "None"];
const EVIDENCE_OPTIONS = ["Photographs Taken", "Video / CCTV Captured", "Witness Statements", "Physical Evidence Collected", "Body-Cam Footage", "Audio Recording", "None"];
const ACTIONS_OPTIONS = ["Area Secured / Cordoned Off", "First Aid Administered", "Suspect Detained", "Suspect Trespassed / Issued CTW", "Verbal Warning Issued", "Escorted Individual Off Property", "Locked / Secured Access Point", "Filed Police Report", "Notified Management", "Completed Incident Log", "Monitored via CCTV", "De-escalation Techniques Used"];
const INJURY_TYPES = ["None", "Minor — No Medical Needed", "Moderate — First Aid Given", "Serious — EMS Called", "Fatal"];
const PROPERTY_DAMAGE = ["None", "Minor (< $500)", "Moderate ($500–$5,000)", "Major (> $5,000)", "Unknown"];


export default function IncidentsPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore(s => s.getActiveCompany());
  const isAdmin = activeCompany && hasMinRole(activeCompany.role as CompanyRole, "manager");

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Record<string, IncidentUpdate[]>>({});
  const [newComment, setNewComment] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Create form — core
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("general");
  const [newSeverity, setNewSeverity] = useState("low");
  const [newPriority, setNewPriority] = useState("medium");
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);
  // Create form — enhanced fields
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [weather, setWeather] = useState("");
  const [lighting, setLighting] = useState("");
  const [witnesses, setWitnesses] = useState(false);
  const [witnessCount, setWitnessCount] = useState("");
  const [witnessDetails, setWitnessDetails] = useState("");
  const [injuryLevel, setInjuryLevel] = useState("None");
  const [injuryDetails, setInjuryDetails] = useState("");
  const [propertyDamage, setPropertyDamage] = useState("None");
  const [damageDetails, setDamageDetails] = useState("");
  const [servicesNotified, setServicesNotified] = useState<string[]>([]);
  const [evidenceCollected, setEvidenceCollected] = useState<string[]>([]);
  const [actionsTaken, setActionsTaken] = useState<string[]>([]);
  const [suspectDesc, setSuspectDesc] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const [inc, mem] = await Promise.all([
        getIncidents(activeCompanyId, filter),
        getCompanyMembers(activeCompanyId),
      ]);
      setIncidents(inc);
      setMembers(mem);
    } catch { /* */ } finally { setLoading(false); }
  }, [activeCompanyId, filter]);

  useEffect(() => { load(); }, [load]);

  function buildDescription() {
    const parts: string[] = [];
    if (newDesc.trim()) parts.push(newDesc.trim());
    if (incidentDate || incidentTime) parts.push(`\n--- When ---\nDate: ${incidentDate || "Not specified"}  Time: ${incidentTime || "Not specified"}`);
    if (weather) parts.push(`Weather: ${weather}`);
    if (lighting) parts.push(`Lighting: ${lighting}`);
    if (witnesses) parts.push(`\n--- Witnesses ---\nWitnesses Present: Yes${witnessCount ? ` (${witnessCount})` : ""}${witnessDetails ? `\nDetails: ${witnessDetails}` : ""}`);
    if (injuryLevel !== "None") parts.push(`\n--- Injuries ---\nLevel: ${injuryLevel}${injuryDetails ? `\nDetails: ${injuryDetails}` : ""}`);
    if (propertyDamage !== "None") parts.push(`\n--- Property Damage ---\nEstimate: ${propertyDamage}${damageDetails ? `\nDetails: ${damageDetails}` : ""}`);
    if (servicesNotified.length > 0) parts.push(`\n--- Services Notified ---\n${servicesNotified.join(", ")}`);
    if (actionsTaken.length > 0) parts.push(`\n--- Actions Taken ---\n${actionsTaken.join(", ")}`);
    if (evidenceCollected.length > 0) parts.push(`\n--- Evidence ---\n${evidenceCollected.join(", ")}`);
    if (suspectDesc.trim()) parts.push(`\n--- Suspect Description ---\n${suspectDesc.trim()}`);
    if (followUp) parts.push(`\n--- Follow-Up Required ---\n${followUpNotes.trim() || "Yes — details pending"}`);
    return parts.join("\n");
  }

  function resetCreateForm() {
    setNewTitle(""); setNewDesc(""); setNewType("general");
    setNewSeverity("low"); setNewPriority("medium"); setNewLocation("");
    setIncidentDate(""); setIncidentTime(""); setWeather(""); setLighting("");
    setWitnesses(false); setWitnessCount(""); setWitnessDetails("");
    setInjuryLevel("None"); setInjuryDetails(""); setPropertyDamage("None"); setDamageDetails("");
    setServicesNotified([]); setEvidenceCollected([]); setActionsTaken([]);
    setSuspectDesc(""); setFollowUp(false); setFollowUpNotes(""); setShowAdvanced(false);
  }

  async function handleCreate() {
    if (!newTitle.trim() || !activeCompanyId) return;
    setCreating(true);
    try {
      await createIncident(activeCompanyId, {
        title: newTitle, description: buildDescription(), type: newType,
        severity: newSeverity, priority: newPriority, location: newLocation,
      });
      resetCreateForm();
      setShowCreate(false);
      await load();
    } catch { /* */ } finally { setCreating(false); }
  }

  async function handleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!updates[id]) {
      const u = await getIncidentUpdates(id);
      setUpdates(prev => ({ ...prev, [id]: u }));
    }
  }

  async function handleAddComment(incidentId: string) {
    if (!newComment.trim()) return;
    const u = await addIncidentUpdate(incidentId, newComment);
    setUpdates(prev => ({ ...prev, [incidentId]: [...(prev[incidentId] ?? []), u] }));
    setNewComment("");
  }

  async function handleStatusChange(incidentId: string, status: string) {
    await updateIncident(incidentId, { status });
    if (status === "resolved") {
      await addIncidentUpdate(incidentId, `Status changed to ${status}`, "status_change");
    }
    await load();
  }

  async function handleAssign(incidentId: string, userId: string) {
    await updateIncident(incidentId, { assigned_to: userId || null });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this incident?")) return;
    await deleteIncident(id);
    await load();
  }

  const filtered = incidents.filter((i: Incident) =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.description?.toLowerCase().includes(search.toLowerCase())
  );

  const sevInfo = (sev: string) => SEVERITY.find(s => s.value === sev) ?? SEVERITY[3];
  const statInfo = (st: string) => STATUS.find(s => s.value === st) ?? STATUS[0];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
              REPORTS
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Incident reports, field reports, and documentation</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Report Incident
          </Button>
        </div>

        {/* Report type tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
          <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
            <AlertTriangle className="h-3.5 w-3.5" />
            Incidents
          </div>
          <Link
            href="/forms"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Field Reports
          </Link>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card className="border-amber-500/30">
            <CardHeader><CardTitle className="text-base">New Incident Report</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {/* ── Section 1: Core Info ── */}
              <div className="space-y-3">
                <Input placeholder="Incident title / summary *" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Type *</label>
                    <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newType} onChange={e => setNewType(e.target.value)}>
                      {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Severity</label>
                    <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newSeverity} onChange={e => setNewSeverity(e.target.value)}>
                      {SEVERITY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Location / Post</label>
                    <Input className="mt-1" placeholder="Building, floor, area..." value={newLocation} onChange={e => setNewLocation(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* ── Section 2: When & Conditions ── */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">When &amp; Conditions</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Date of Incident</label>
                    <Input type="date" className="mt-1" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Time of Incident</label>
                    <Input type="time" className="mt-1" value={incidentTime} onChange={e => setIncidentTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Weather</label>
                    <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={weather} onChange={e => setWeather(e.target.value)}>
                      <option value="">Select...</option>
                      {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Lighting</label>
                    <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={lighting} onChange={e => setLighting(e.target.value)}>
                      <option value="">Select...</option>
                      {LIGHTING_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Section 3: Narrative ── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Narrative</p>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                  placeholder="Describe what happened in detail — who, what, when, where, how. Be factual and objective."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>

              {/* ── Section 4: Involved Parties (collapsible) ── */}
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showAdvanced ? "Hide" : "Show"} Additional Details (injuries, evidence, follow-up...)
              </button>

              {showAdvanced && (
                <div className="space-y-5 rounded-lg border border-border/50 bg-muted/20 p-4">
                  {/* Witnesses */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Witnesses</p>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={witnesses} onChange={e => setWitnesses(e.target.checked)} className="rounded" />
                        Witnesses present
                      </label>
                      {witnesses && (
                        <Input className="w-20" type="number" min="1" placeholder="#" value={witnessCount} onChange={e => setWitnessCount(e.target.value)} />
                      )}
                    </div>
                    {witnesses && (
                      <Input placeholder="Witness names / contact info (if available)" value={witnessDetails} onChange={e => setWitnessDetails(e.target.value)} />
                    )}
                  </div>

                  {/* Injuries & Property Damage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Injuries</p>
                      <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={injuryLevel} onChange={e => setInjuryLevel(e.target.value)}>
                        {INJURY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {injuryLevel !== "None" && (
                        <Input placeholder="Describe injuries, persons affected..." value={injuryDetails} onChange={e => setInjuryDetails(e.target.value)} />
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property Damage</p>
                      <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={propertyDamage} onChange={e => setPropertyDamage(e.target.value)}>
                        {PROPERTY_DAMAGE.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {propertyDamage !== "None" && (
                        <Input placeholder="Describe damage..." value={damageDetails} onChange={e => setDamageDetails(e.target.value)} />
                      )}
                    </div>
                  </div>

                  {/* Services Notified */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services Notified</p>
                    <div className="flex flex-wrap gap-2">
                      {SERVICES_OPTIONS.map(s => (
                        <label key={s} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border cursor-pointer transition-all ${
                          servicesNotified.includes(s) ? "border-blue-500 bg-blue-500/15 text-blue-700" : "border-border hover:border-primary/30"
                        }`}>
                          <input type="checkbox" className="sr-only" checked={servicesNotified.includes(s)}
                            onChange={e => setServicesNotified(prev => e.target.checked ? [...prev, s] : prev.filter(x => x !== s))} />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Actions Taken */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions Taken</p>
                    <div className="flex flex-wrap gap-2">
                      {ACTIONS_OPTIONS.map(a => (
                        <label key={a} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border cursor-pointer transition-all ${
                          actionsTaken.includes(a) ? "border-emerald-500 bg-emerald-500/15 text-emerald-700" : "border-border hover:border-primary/30"
                        }`}>
                          <input type="checkbox" className="sr-only" checked={actionsTaken.includes(a)}
                            onChange={e => setActionsTaken(prev => e.target.checked ? [...prev, a] : prev.filter(x => x !== a))} />
                          {a}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Evidence */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidence Collected</p>
                    <div className="flex flex-wrap gap-2">
                      {EVIDENCE_OPTIONS.map(e => (
                        <label key={e} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border cursor-pointer transition-all ${
                          evidenceCollected.includes(e) ? "border-violet-500 bg-violet-500/15 text-violet-700" : "border-border hover:border-primary/30"
                        }`}>
                          <input type="checkbox" className="sr-only" checked={evidenceCollected.includes(e)}
                            onChange={ev => setEvidenceCollected(prev => ev.target.checked ? [...prev, e] : prev.filter(x => x !== e))} />
                          {e}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Suspect Description */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suspect / Person of Interest</p>
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                      placeholder="Physical description, clothing, direction of travel, vehicle info... (leave blank if N/A)"
                      value={suspectDesc}
                      onChange={e => setSuspectDesc(e.target.value)}
                    />
                  </div>

                  {/* Follow-up */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Follow-Up</p>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)} className="rounded" />
                      Follow-up action required
                    </label>
                    {followUp && (
                      <Input placeholder="Describe required follow-up actions..." value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} />
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                  Submit Report
                </Button>
                <Button variant="outline" onClick={() => { resetCreateForm(); setShowCreate(false); }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search incidents..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {[{ value: "all", label: "All", color: "" }, ...STATUS].map(s => (
              <Button
                key={s.value}
                variant={filter === s.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(s.value)}
                className="text-xs"
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Open", count: incidents.filter((i: Incident) => i.status === "open").length, color: "text-red-500" },
            { label: "Investigating", count: incidents.filter((i: Incident) => i.status === "investigating").length, color: "text-amber-500" },
            { label: "Resolved", count: incidents.filter((i: Incident) => i.status === "resolved").length, color: "text-green-500" },
            { label: "Critical", count: incidents.filter((i: Incident) => i.severity === "critical").length, color: "text-red-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.count}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Incident List */}
        {loading ? (
          <ListSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No incidents reported</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inc: Incident) => {
              const sev = sevInfo(inc.severity);
              const stat = statInfo(inc.status);
              const isExpanded = expanded === inc.id;
              const SevIcon = sev.icon;
              return (
                <Card key={inc.id} className={`overflow-hidden ${inc.severity === "critical" ? "border-red-500/40" : ""}`}>
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => handleExpand(inc.id)}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sev.color}`}>
                      <SevIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{inc.title}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${stat.color}`}>
                          {stat.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                          {inc.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {inc.reported_user?.first_name} {inc.reported_user?.last_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(inc.created_at)}
                        </span>
                        {inc.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {inc.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
                      {inc.description && (() => {
                        const raw: string = inc.description;
                        const sectionRegex = /---\s*(.+?)\s*---/g;
                        const headers: { heading: string; start: number; end: number }[] = [];
                        let m: RegExpExecArray | null;
                        while ((m = sectionRegex.exec(raw)) !== null) {
                          headers.push({ heading: m[1], start: m.index, end: m.index + m[0].length });
                        }
                        const tokens: { heading?: string; body: string }[] = [];
                        if (headers.length === 0) {
                          tokens.push({ body: raw });
                        } else {
                          const preamble = raw.slice(0, headers[0].start).trim();
                          if (preamble) tokens.push({ body: preamble });
                          for (let i = 0; i < headers.length; i++) {
                            const bodyEnd = i + 1 < headers.length ? headers[i + 1].start : raw.length;
                            tokens.push({ heading: headers[i].heading, body: raw.slice(headers[i].end, bodyEnd).trim() });
                          }
                        }

                        return (
                          <div className="space-y-3">
                            {tokens.map((t, i) => t.heading ? (
                              <div key={i} className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.heading}</p>
                                <p className="text-sm text-foreground/90 whitespace-pre-line">{t.body}</p>
                              </div>
                            ) : t.body ? (
                              <div key={i} className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Narrative</p>
                                <p className="text-sm text-foreground/90 whitespace-pre-line">{t.body}</p>
                              </div>
                            ) : null)}
                          </div>
                        );
                      })()}

                      {/* Actions */}
                      {isAdmin && (
                        <div className="flex flex-wrap gap-3 items-center">
                          <div>
                            <label className="text-xs text-muted-foreground">Status</label>
                            <select
                              className="ml-2 rounded border border-input bg-background px-2 py-1 text-xs"
                              value={inc.status}
                              onChange={e => handleStatusChange(inc.id, e.target.value)}
                            >
                              {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Assign to</label>
                            <select
                              className="ml-2 rounded border border-input bg-background px-2 py-1 text-xs"
                              value={inc.assigned_to ?? ""}
                              onChange={e => handleAssign(inc.id, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {members.map((m: Member) => (
                                <option key={m.user_id} value={m.user_id}>
                                  {m.users?.first_name} {m.users?.last_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          {inc.assigned_to && inc.assigned_user && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> Assigned: {inc.assigned_user.first_name} {inc.assigned_user.last_name}
                            </span>
                          )}
                          <Button variant="ghost" size="sm" className="text-red-500 ml-auto" onClick={() => handleDelete(inc.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Timeline */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Activity Timeline
                        </h4>
                        <div className="space-y-2">
                          {(updates[inc.id] ?? []).length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No updates yet</p>
                          ) : (
                            (updates[inc.id] ?? []).map((u: IncidentUpdate) => (
                              <div key={u.id} className={`flex items-start gap-2 text-sm ${u.type === "status_change" ? "text-amber-600" : ""}`}>
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary mt-0.5">
                                  {u.users?.first_name?.[0]}{u.users?.last_name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-xs">{u.users?.first_name} {u.users?.last_name}</span>
                                  <span className="text-[10px] text-muted-foreground ml-2">{timeAgo(u.created_at)}</span>
                                  {u.type === "status_change" ? (
                                    <p className="text-xs italic flex items-center gap-1 mt-0.5">
                                      {u.content.includes("resolved") ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <CircleDot className="h-3 w-3" />}
                                      {u.content}
                                    </p>
                                  ) : (
                                    <p className="text-xs mt-0.5 text-foreground/80">{u.content}</p>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Input
                            placeholder="Add update..."
                            className="text-sm"
                            value={expanded === inc.id ? newComment : ""}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddComment(inc.id)}
                          />
                          <Button size="sm" onClick={() => handleAddComment(inc.id)} disabled={!newComment.trim()}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
