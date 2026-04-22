"use client";

import { useState } from "react";
import { Megaphone, Send, Loader2, Check, Users, Shield, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { sendBroadcast, getCompanyBroadcasts, type Broadcast, type BroadcastUrgency, type BroadcastTarget } from "@/lib/supabase/db";

interface BroadcastPanelProps {
  activeCompanyId: string;
}

const URGENCY_OPTIONS: { value: BroadcastUrgency; label: string; color: string }[] = [
  { value: "normal", label: "Normal", color: "border-border/40" },
  { value: "urgent", label: "Urgent", color: "border-amber-500/60 bg-amber-500/10" },
  { value: "critical", label: "Critical", color: "border-red-500/60 bg-red-500/10" },
];

const TARGET_OPTIONS: { value: BroadcastTarget; label: string; icon: typeof Users }[] = [
  { value: "all", label: "All Staff", icon: Users },
  { value: "on_duty", label: "On Duty Only", icon: Shield },
  { value: "managers", label: "Managers Only", icon: Radio },
];

export function BroadcastPanel({ activeCompanyId }: BroadcastPanelProps) {
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState<BroadcastUrgency>("normal");
  const [target, setTarget] = useState<BroadcastTarget>("all");
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<Broadcast[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadRecent() {
    if (loaded) return;
    const data = await getCompanyBroadcasts(activeCompanyId, 10);
    setRecent(data);
    setLoaded(true);
  }

  async function handleSend() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSending(true);
    try {
      const id = await sendBroadcast(activeCompanyId, { title: title.trim(), body: body.trim(), urgency, target });
      if (id) {
        toast.success(`Broadcast sent to ${target === "all" ? "all staff" : target === "on_duty" ? "on-duty staff" : "managers"}`);
        setTitle(""); setBody(""); setUrgency("normal"); setTarget("all"); setShowCompose(false);
        setLoaded(false); // Refresh recent
      } else {
        toast.error("Failed to send broadcast");
      }
    } catch { toast.error("Broadcast failed"); }
    finally { setSending(false); }
  }

  return (
    <div className="space-y-4">
      {/* Compose button */}
      {!showCompose && (
        <Button className="gap-2 w-full" onClick={() => { setShowCompose(true); loadRecent(); }}>
          <Megaphone className="h-4 w-4" /> Send Broadcast
        </Button>
      )}

      {/* Compose form */}
      {showCompose && (
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" /> New Broadcast
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowCompose(false)}>Cancel</Button>
          </div>

          <div>
            <Label htmlFor="broadcast-title" className="text-xs">Title</Label>
            <Input id="broadcast-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject line..." className="mt-1" />
          </div>

          <div>
            <Label htmlFor="broadcast-body" className="text-xs">Message</Label>
            <textarea id="broadcast-body" value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Message body (optional)..."
              className="mt-1 w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
          </div>

          {/* Urgency */}
          <div>
            <Label className="text-xs">Urgency</Label>
            <div className="flex gap-2 mt-1">
              {URGENCY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setUrgency(opt.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${urgency === opt.value ? opt.color + " font-bold" : "border-border/40 text-muted-foreground"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target audience */}
          <div>
            <Label className="text-xs">Send to</Label>
            <div className="flex gap-2 mt-1">
              {TARGET_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setTarget(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${target === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
                  <opt.icon className="h-3 w-3" /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSend} disabled={sending} className="gap-2 w-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send {urgency === "critical" ? "Critical Alert" : "Broadcast"}
          </Button>
        </div>
      )}

      {/* Recent broadcasts */}
      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Recent Broadcasts</p>
          {recent.map((b) => {
            const ackPct = b.totalRecipients > 0 ? Math.round((b.acknowledgedBy.length / b.totalRecipients) * 100) : 0;
            return (
              <div key={b.id} className="rounded-lg border border-border/40 bg-card/50 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{b.title}</span>
                  <Badge className={`text-[9px] ${b.urgency === "critical" ? "bg-red-500/15 text-red-500" : b.urgency === "urgent" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>
                    {b.urgency}
                  </Badge>
                </div>
                {b.body && <p className="text-[11px] text-muted-foreground">{b.body}</p>}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{b.senderName}</span>
                  <span>{new Date(b.createdAt).toLocaleString()}</span>
                  <span className="flex items-center gap-1">
                    <Check className="h-2.5 w-2.5" /> {b.acknowledgedBy.length}/{b.totalRecipients} ({ackPct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
