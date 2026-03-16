"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Footprints,
  Plus,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  ScanLine,
  Route,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import {
  getCheckpoints,
  createCheckpoint,
  deleteCheckpoint,
  getPatrolRoutes,
  createPatrolRoute,
  deletePatrolRoute,
  logPatrolScan,
  getPatrolLogs,
} from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Checkpoint = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PatrolRoute = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PatrolLog = any;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PatrolsPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore(s => s.getActiveCompany());
  const isAdmin = activeCompany && ["owner", "admin", "manager"].includes(activeCompany.role);

  const [tab, setTab] = useState<"scan" | "checkpoints" | "routes" | "log">("scan");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Scan state
  const [selectedCheckpoint, setSelectedCheckpoint] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [scanNote, setScanNote] = useState("");
  const [scanStatus, setScanStatus] = useState("ok");
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<PatrolLog | null>(null);
  // Enhanced scan fields
  const [scanWeather, setScanWeather] = useState("");
  const [scanLighting, setScanLighting] = useState("");
  const [doorStatus, setDoorStatus] = useState("");
  const [scanObservations, setScanObservations] = useState<string[]>([]);
  const [showScanDetails, setShowScanDetails] = useState(false);

  // Create checkpoint
  const [cpName, setCpName] = useState("");
  const [cpLocation, setCpLocation] = useState("");
  const [cpDesc, setCpDesc] = useState("");

  // Create route
  const [rtName, setRtName] = useState("");
  const [rtDesc, setRtDesc] = useState("");
  const [rtFreq, setRtFreq] = useState("60");
  const [rtCheckpoints, setRtCheckpoints] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const [cp, rt, lg] = await Promise.all([
        getCheckpoints(activeCompanyId),
        getPatrolRoutes(activeCompanyId),
        getPatrolLogs(activeCompanyId, 50),
      ]);
      setCheckpoints(cp);
      setRoutes(rt);
      setLogs(lg);
    } catch { /* */ } finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  function buildScanNotes() {
    const parts: string[] = [];
    if (scanNote.trim()) parts.push(scanNote.trim());
    const details: string[] = [];
    if (scanWeather) details.push(`Weather: ${scanWeather}`);
    if (scanLighting) details.push(`Lighting: ${scanLighting}`);
    if (doorStatus) details.push(`Doors/Gates: ${doorStatus}`);
    if (scanObservations.length > 0) details.push(`Observations: ${scanObservations.join(", ")}`);
    if (details.length > 0) parts.push(details.join(" | "));
    return parts.join("\n") || undefined;
  }

  async function handleScan() {
    if (!selectedCheckpoint || !activeCompanyId) return;
    setScanning(true);
    try {
      const result = await logPatrolScan(activeCompanyId, selectedCheckpoint, {
        routeId: selectedRoute || undefined,
        notes: buildScanNotes(),
        status: scanStatus,
      });
      setLastScan(result);
      setScanNote(""); setScanStatus("ok");
      setScanWeather(""); setScanLighting(""); setDoorStatus("");
      setScanObservations([]); setShowScanDetails(false);
      await load();
    } catch { /* */ } finally { setScanning(false); }
  }

  async function handleCreateCheckpoint() {
    if (!cpName.trim() || !activeCompanyId) return;
    await createCheckpoint(activeCompanyId, {
      name: cpName, location: cpLocation || undefined, description: cpDesc || undefined,
    });
    setCpName(""); setCpLocation(""); setCpDesc("");
    await load();
  }

  async function handleCreateRoute() {
    if (!rtName.trim() || rtCheckpoints.length === 0 || !activeCompanyId) return;
    await createPatrolRoute(activeCompanyId, {
      name: rtName, description: rtDesc || undefined,
      checkpointIds: rtCheckpoints, frequencyMin: parseInt(rtFreq) || 60,
    });
    setRtName(""); setRtDesc(""); setRtFreq("60"); setRtCheckpoints([]);
    await load();
  }

  function toggleRouteCheckpoint(id: string) {
    setRtCheckpoints(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  // Patrol compliance: count today's scans vs expected
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((l: PatrolLog) => new Date(l.scanned_at) >= todayStart);
  const uniqueCheckpointsToday = new Set(todayLogs.map((l: PatrolLog) => l.checkpoint_id)).size;
  const compliancePercent = checkpoints.length > 0
    ? Math.min(100, Math.round((uniqueCheckpointsToday / checkpoints.length) * 100))
    : 0;

  const TABS = [
    { id: "scan" as const, label: "Scan", icon: ScanLine },
    { id: "checkpoints" as const, label: "Checkpoints", icon: MapPin },
    { id: "routes" as const, label: "Routes", icon: Route },
    { id: "log" as const, label: "Activity", icon: Clock },
  ];

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <Footprints className="h-5 w-5 sm:h-6 sm:w-6" />
            PATROLS
          </h1>
          <p className="text-sm text-muted-foreground">Checkpoint verification & patrol tracking</p>
        </div>

        {/* Compliance Banner */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-500/10 to-transparent">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className="text-emerald-500" strokeDasharray={`${compliancePercent} ${100 - compliancePercent}`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute text-sm font-bold font-mono">{compliancePercent}%</span>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s Coverage</div>
                <div className="text-lg font-bold">{uniqueCheckpointsToday} / {checkpoints.length} checkpoints</div>
                <div className="text-xs text-muted-foreground">{todayLogs.length} total scans today</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                tab === t.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* SCAN TAB */}
            {tab === "scan" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScanLine className="h-5 w-5 text-emerald-500" /> Log Checkpoint Scan</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Checkpoint *</label>
                      <select
                        className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedCheckpoint}
                        onChange={e => setSelectedCheckpoint(e.target.value)}
                      >
                        <option value="">Select checkpoint...</option>
                        {checkpoints.map((cp: Checkpoint) => (
                          <option key={cp.id} value={cp.id}>{cp.name}{cp.location ? ` — ${cp.location}` : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Patrol Route (optional)</label>
                      <select
                        className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedRoute}
                        onChange={e => setSelectedRoute(e.target.value)}
                      >
                        <option value="">No route</option>
                        {routes.map((rt: PatrolRoute) => (
                          <option key={rt.id} value={rt.id}>{rt.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Status *</label>
                        <select
                          className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={scanStatus}
                          onChange={e => setScanStatus(e.target.value)}
                        >
                          <option value="ok">✓ All Clear</option>
                          <option value="issue">⚠ Issue Found</option>
                          <option value="emergency">🚨 Emergency</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Notes</label>
                        <Input className="mt-1" placeholder="Quick note (optional)" value={scanNote} onChange={e => setScanNote(e.target.value)} />
                      </div>
                    </div>

                    {/* Expanded observations */}
                    <button
                      type="button"
                      className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                      onClick={() => setShowScanDetails(!showScanDetails)}
                    >
                      {showScanDetails ? "▲ Hide" : "▼ Show"} Conditions &amp; Observations
                    </button>

                    {showScanDetails && (
                      <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Weather</label>
                            <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={scanWeather} onChange={e => setScanWeather(e.target.value)}>
                              <option value="">Select...</option>
                              <option value="Clear">Clear</option>
                              <option value="Cloudy">Cloudy</option>
                              <option value="Rain">Rain</option>
                              <option value="Snow">Snow</option>
                              <option value="Fog">Fog</option>
                              <option value="Extreme Heat">Extreme Heat</option>
                              <option value="Extreme Cold">Extreme Cold</option>
                              <option value="Indoors">N/A — Indoors</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Lighting</label>
                            <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={scanLighting} onChange={e => setScanLighting(e.target.value)}>
                              <option value="">Select...</option>
                              <option value="Well-lit">Well-lit</option>
                              <option value="Dim">Dim / Partial</option>
                              <option value="Dark">Dark / No Lighting</option>
                              <option value="Flickering">Flickering / Faulty</option>
                              <option value="Daylight">Natural Daylight</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Doors / Gates</label>
                            <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={doorStatus} onChange={e => setDoorStatus(e.target.value)}>
                              <option value="">Select...</option>
                              <option value="All Secured">All Secured</option>
                              <option value="Unlocked — Expected">Unlocked — Expected</option>
                              <option value="Unlocked — Unexpected">Unlocked — Unexpected</option>
                              <option value="Propped Open">Propped Open</option>
                              <option value="Damaged / Tampered">Damaged / Tampered</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observations</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              "Area Clean & Orderly", "Graffiti / Vandalism", "Broken Glass",
                              "Water Leak / Flooding", "Unusual Odor", "Suspicious Person(s)",
                              "Abandoned Property", "Slip / Trip Hazard", "Fire Hazard",
                              "Burnt Out Lights", "Alarm Activated", "Vehicle Parked Illegally",
                              "Loitering", "Noise Complaint", "Wildlife / Pest",
                            ].map(obs => (
                              <label key={obs} className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border cursor-pointer transition-all ${
                                scanObservations.includes(obs) ? "border-emerald-500 bg-emerald-500/15 text-emerald-700" : "border-border hover:border-primary/30 text-muted-foreground"
                              }`}>
                                <input type="checkbox" className="sr-only" checked={scanObservations.includes(obs)}
                                  onChange={e => setScanObservations(prev => e.target.checked ? [...prev, obs] : prev.filter(x => x !== obs))} />
                                {obs}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={handleScan}
                      disabled={!selectedCheckpoint || scanning}
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                      size="lg"
                    >
                      {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                      Confirm Checkpoint Scan
                    </Button>

                    {lastScan && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <span className="font-medium text-emerald-700">Scan recorded successfully</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Scans */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <RotateCw className="h-3 w-3" /> Recent Scans
                  </h3>
                  <div className="space-y-2">
                    {todayLogs.slice(0, 10).map((log: PatrolLog) => (
                      <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          log.status === "emergency" ? "bg-red-500/15 text-red-500" :
                          log.status === "issue" ? "bg-amber-500/15 text-amber-500" :
                          "bg-emerald-500/15 text-emerald-500"
                        }`}>
                          {log.status === "emergency" ? <AlertTriangle className="h-4 w-4" /> :
                           log.status === "issue" ? <AlertTriangle className="h-4 w-4" /> :
                           <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{log.checkpoints?.name}</div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.users?.first_name} {log.users?.last_name}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(log.scanned_at)}</span>
                            {log.checkpoints?.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{log.checkpoints.location}</span>}
                          </div>
                          {log.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{log.notes}</p>}
                        </div>
                      </div>
                    ))}
                    {todayLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No scans today</p>}
                  </div>
                </div>
              </div>
            )}

            {/* CHECKPOINTS TAB */}
            {tab === "checkpoints" && (
              <div className="space-y-4">
                {isAdmin && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Add Checkpoint</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <Input placeholder="Checkpoint name *" value={cpName} onChange={e => setCpName(e.target.value)} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Location" value={cpLocation} onChange={e => setCpLocation(e.target.value)} />
                        <Input placeholder="Description" value={cpDesc} onChange={e => setCpDesc(e.target.value)} />
                      </div>
                      <Button onClick={handleCreateCheckpoint} disabled={!cpName.trim()} className="gap-2">
                        <Plus className="h-4 w-4" /> Add Checkpoint
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  {checkpoints.map((cp: Checkpoint, idx: number) => (
                    <Card key={cp.id}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 font-bold text-sm font-mono">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{cp.name}</div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {cp.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{cp.location}</span>}
                            <span className="text-[10px] font-mono text-muted-foreground/60">{cp.qr_code}</span>
                          </div>
                          {cp.description && <p className="text-xs text-muted-foreground mt-0.5">{cp.description}</p>}
                        </div>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { deleteCheckpoint(cp.id); load(); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {checkpoints.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>No checkpoints yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ROUTES TAB */}
            {tab === "routes" && (
              <div className="space-y-4">
                {isAdmin && checkpoints.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Create Patrol Route</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Route name *" value={rtName} onChange={e => setRtName(e.target.value)} />
                        <Input placeholder="Frequency (min)" type="number" value={rtFreq} onChange={e => setRtFreq(e.target.value)} />
                      </div>
                      <Input placeholder="Description" value={rtDesc} onChange={e => setRtDesc(e.target.value)} />
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Select checkpoints in order:</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {checkpoints.map((cp: Checkpoint) => {
                            const idx = rtCheckpoints.indexOf(cp.id);
                            const selected = idx !== -1;
                            return (
                              <button
                                key={cp.id}
                                onClick={() => toggleRouteCheckpoint(cp.id)}
                                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                                  selected
                                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-700"
                                    : "border-border hover:border-primary/30"
                                }`}
                              >
                                {selected && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] font-bold">{idx + 1}</span>}
                                <MapPin className="h-3 w-3" />
                                {cp.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Button onClick={handleCreateRoute} disabled={!rtName.trim() || rtCheckpoints.length === 0} className="gap-2">
                        <Plus className="h-4 w-4" /> Create Route
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  {routes.map((rt: PatrolRoute) => {
                    const cpNames = (rt.checkpoint_ids ?? []).map((id: string) => {
                      const cp = checkpoints.find((c: Checkpoint) => c.id === id);
                      return cp?.name ?? "?";
                    });
                    return (
                      <Card key={rt.id}>
                        <CardContent className="flex items-center gap-3 p-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                            <Route className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">{rt.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {cpNames.length} checkpoints · Every {rt.frequency_min}min
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cpNames.map((name: string, i: number) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-muted rounded px-1.5 py-0.5">
                                  <span className="font-bold text-emerald-600">{i + 1}</span> {name}
                                </span>
                              ))}
                            </div>
                          </div>
                          {isAdmin && (
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { deletePatrolRoute(rt.id); load(); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {routes.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Route className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>No patrol routes defined</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACTIVITY LOG TAB */}
            {tab === "log" && (
              <div className="space-y-2">
                {logs.map((log: PatrolLog) => (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      log.status === "emergency" ? "bg-red-500/15 text-red-500" :
                      log.status === "issue" ? "bg-amber-500/15 text-amber-500" :
                      "bg-emerald-500/15 text-emerald-500"
                    }`}>
                      {log.status === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{log.checkpoints?.name ?? "Unknown"}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.users?.first_name} {log.users?.last_name}</span>
                        <span>{new Date(log.scanned_at).toLocaleString()}</span>
                      </div>
                      {log.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{log.notes}</p>}
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      log.status === "emergency" ? "bg-red-500/15 text-red-600" :
                      log.status === "issue" ? "bg-amber-500/15 text-amber-600" :
                      "bg-emerald-500/15 text-emerald-600"
                    }`}>
                      {log.status}
                    </span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Footprints className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No patrol activity recorded</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
