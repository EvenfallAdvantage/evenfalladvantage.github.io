"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConflictWarningData {
  shiftId: string;
  userId: string;
  conflicts: { role: string; eventName: string; time: string }[];
  pendingAction: () => Promise<void>;
}

interface ConflictWarningModalProps {
  data: ConflictWarningData;
  onClose: () => void;
}

export function ConflictWarningModal({ data, onClose }: ConflictWarningModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/10 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <h3 className="text-sm font-bold">Shift Conflict Detected</h3>
            <p className="text-xs text-muted-foreground mt-0.5">This person already has overlapping shift(s):</p>
          </div>
        </div>
        <div className="px-5 py-3 space-y-2 max-h-48 overflow-auto">
          {data.conflicts.map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <span className="font-medium">{c.role}</span>
                <span className="text-muted-foreground"> — {c.eventName}</span>
                <span className="text-muted-foreground font-mono ml-1.5">{c.time}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/30 px-5 py-3">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700"
            onClick={async () => {
              const action = data.pendingAction;
              onClose();
              try { await action(); } catch (err) { console.error(err); }
            }}>
            <AlertTriangle className="h-3.5 w-3.5" /> Assign Anyway
          </Button>
        </div>
      </div>
    </div>
  );
}
