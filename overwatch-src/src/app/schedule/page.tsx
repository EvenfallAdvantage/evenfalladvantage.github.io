"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays, MapPin, Clock, Loader2, QrCode,
  Plus, ArrowUpFromLine, ArrowDownToLine, Trash2, Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { getUpcomingEvents, getUserShifts, getAssets, createAsset, checkoutAsset, checkinAsset, deleteAsset } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ev = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Asset = any;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SchedulePage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = ["owner", "admin", "manager"].includes(activeCompany?.role ?? "");

  const [tab, setTab] = useState<"schedule" | "armory">("schedule");

  // Schedule state
  const [events, setEvents] = useState<Ev[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Armory state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [remindersSent, setRemindersSent] = useState(false);

  const loadSchedule = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [ev, sh] = await Promise.all([
        getUpcomingEvents(activeCompanyId),
        getUserShifts(activeCompanyId),
      ]);
      setEvents(ev);
      setShifts(sh);
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  const loadAssets = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setAssetsLoading(false); return; }
    try { setAssets(await getAssets(activeCompanyId)); } catch {} finally { setAssetsLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadSchedule(); loadAssets(); }, [loadSchedule, loadAssets]);

  const statusColor = (s: string) => {
    if (s === "published" || s === "confirmed") return "bg-green-500/15 text-green-600";
    if (s === "draft") return "bg-amber-500/15 text-amber-600";
    return "bg-muted text-muted-foreground";
  };

  const assetStatusColor = (s: string) => {
    if (s === "available") return "bg-green-500/15 text-green-600";
    if (s === "checked_out") return "bg-amber-500/15 text-amber-600";
    return "bg-muted text-muted-foreground";
  };

  async function handleCreateAsset() {
    if (!newName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createAsset({ companyId: activeCompanyId, name: newName.trim(), assetType: newType || undefined, serialNumber: newSerial || undefined });
      setNewName(""); setNewType(""); setNewSerial(""); setShowCreate(false); await loadAssets();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  async function handleCheckout(id: string) {
    setActing(id);
    try { await checkoutAsset(id); await loadAssets(); }
    catch (err) { console.error(err); }
    finally { setActing(null); }
  }

  async function handleCheckin(id: string) {
    setActing(id);
    try { await checkinAsset(id); await loadAssets(); }
    catch (err) { console.error(err); }
    finally { setActing(null); }
  }

  async function handleSendReminders() {
    if (!activeCompanyId || activeCompanyId === "pending" || !shifts.length) return;
    setSendingReminders(true);
    try {
      const { dispatch } = await import("@/lib/services/notification-dispatcher");
      const { sendWhatsAppShiftReminder } = await import("@/lib/services/whatsapp-service");
      const { sendShiftReminderSMS } = await import("@/lib/services/sms-service");
      const { sendEmail, buildShiftReminderEmail } = await import("@/lib/services/email-service");
      const { getCompanyDetails } = await import("@/lib/supabase/db");
      const company = await getCompanyDetails(activeCompanyId);
      const companyName = company?.name ?? "Your Company";

      for (const sh of shifts) {
        const u = Array.isArray(sh.users) ? sh.users[0] : sh.users;
        if (!u?.id) continue;
        const firstName = u.first_name ?? "Team member";
        const shiftDate = fmtDate(sh.start_time);
        const shiftTime = `${fmtTime(sh.start_time)} — ${fmtTime(sh.end_time)}`;
        const location = sh.events?.location;
        // In-app + push notification
        dispatch({
          userId: u.id, companyId: activeCompanyId,
          title: "Shift Reminder",
          body: `${shiftDate} at ${shiftTime}${location ? ` — ${location}` : ""}`,
          type: "shift_reminder", actionUrl: "/schedule",
          phone: u.phone, email: u.email,
          urgent: true, emailFallback: true,
        }).catch(() => {});
        // WhatsApp
        if (u.phone) sendWhatsAppShiftReminder(activeCompanyId, { phone: u.phone, firstName, shiftDate, shiftTime, location }).catch(() => {});
        // SMS
        if (u.phone) sendShiftReminderSMS(activeCompanyId, { phone: u.phone, firstName, shiftDate, shiftTime, location }).catch(() => {});
        // Email
        if (u.email) {
          const tpl = buildShiftReminderEmail({ firstName, companyName, shiftDate, shiftTime, location });
          tpl.to = u.email;
          sendEmail(activeCompanyId, tpl).catch(() => {});
        }
      }
      setRemindersSent(true);
      setTimeout(() => setRemindersSent(false), 3000);
    } catch (err) { console.error("Send reminders failed:", err); }
    finally { setSendingReminders(false); }
  }

  async function handleDeleteAsset(id: string) {
    if (!confirm("Delete this asset?")) return;
    setDeletingAsset(id);
    try { await deleteAsset(id); await loadAssets(); }
    catch (err) { console.error(err); }
    finally { setDeletingAsset(null); }
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" /> DEPLOYMENTS</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4">Your assigned shifts, operations, and equipment</p>
          <div className="flex items-center gap-1 border-b border-border/40">
            <button onClick={() => setTab("schedule")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "schedule" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <CalendarDays className="h-3.5 w-3.5 inline mr-1.5" />Schedule
            </button>
            <button onClick={() => setTab("armory")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "armory" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <QrCode className="h-3.5 w-3.5 inline mr-1.5" />Armory
            </button>
          </div>
        </div>

        {/* ── Schedule Tab ── */}
        {tab === "schedule" && (
          loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {shifts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">My Assigned Shifts</h2>
                    {isAdmin && shifts.length > 0 && (
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                        onClick={handleSendReminders} disabled={sendingReminders}>
                        {sendingReminders ? <Loader2 className="h-3 w-3 animate-spin" /> : remindersSent ? <Bell className="h-3 w-3 text-green-500" /> : <Bell className="h-3 w-3" />}
                        {remindersSent ? "Sent!" : "Send Reminders"}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {shifts.map((sh: Shift) => (
                      <Card key={sh.id} className="border-border/40">
                        <CardContent className="flex items-center gap-4 py-3 px-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                            <Clock className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{sh.events?.name ?? "Shift"}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtDate(sh.start_time)} · {fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}
                            </p>
                            {sh.role && <p className="text-xs text-muted-foreground mt-0.5">Role: {sh.role}</p>}
                          </div>
                          <Badge className={`text-[10px] capitalize ${statusColor(sh.status)}`}>{sh.status}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Upcoming Operations</h2>
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                    <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No upcoming operations</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Operations created by command will appear here when scheduled.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((ev: Ev) => (
                      <Card key={ev.id} className="border-border/40">
                        <CardContent className="flex items-center gap-4 py-3 px-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                            <MapPin className="h-5 w-5 text-violet-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{ev.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtDate(ev.start_date)} · {fmtTime(ev.start_date)} — {fmtTime(ev.end_date)}
                            </p>
                            {ev.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" /> {ev.location}
                              </p>
                            )}
                          </div>
                          <Badge className={`text-[10px] capitalize ${statusColor(ev.status)}`}>{ev.status}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        )}

        {/* ── Armory Tab ── */}
        {tab === "armory" && (
          <>
            {isAdmin && (
              <div className="flex justify-end">
                <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" /> Add Gear
                </Button>
              </div>
            )}

            {showCreate && (
              <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
                <Input placeholder="Equipment name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <div className="flex gap-2">
                  <Input placeholder="Type (e.g. Radio, Vest)" value={newType} onChange={(e) => setNewType(e.target.value)} className="flex-1" />
                  <Input placeholder="Serial #" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} className="flex-1" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateAsset} disabled={!newName.trim() || creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {assetsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <QrCode className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No gear registered</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {isAdmin ? "Add equipment to start tracking inventory." : "Your organization hasn't registered any gear yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {assets.map((a: Asset) => (
                  <div key={a.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                      <QrCode className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{a.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {a.asset_type && <span className="text-xs text-muted-foreground">{a.asset_type}</span>}
                        {a.serial_number && <span className="text-xs text-muted-foreground">SN: {a.serial_number}</span>}
                        {a.users && <span className="text-xs text-primary font-medium">→ {a.users.first_name} {a.users.last_name}</span>}
                      </div>
                    </div>
                    <Badge className={`text-[10px] ${assetStatusColor(a.status)}`}>
                      {a.status === "checked_out" ? "Out" : a.status}
                    </Badge>
                    {a.status === "available" ? (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleCheckout(a.id)} disabled={acting === a.id}>
                        {acting === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpFromLine className="h-3 w-3" />}
                        Check Out
                      </Button>
                    ) : a.status === "checked_out" ? (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleCheckin(a.id)} disabled={acting === a.id}>
                        {acting === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />}
                        Return
                      </Button>
                    ) : null}
                    {isAdmin && (
                      <button onClick={() => handleDeleteAsset(a.id)} disabled={deletingAsset === a.id}
                        className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-red-500/10 hover:text-red-500" title="Delete asset">
                        {deletingAsset === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
