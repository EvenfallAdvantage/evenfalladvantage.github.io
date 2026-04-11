"use client";

import { BookOpen, Users, CheckCircle2, XCircle, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ReadinessModalProps {
  data: any;
  onClose: () => void;
}

export function ReadinessModal({ data, onClose }: ReadinessModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm max-h-[85vh] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4 shrink-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={data.member.users?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
              {(data.member.users?.first_name?.[0] ?? "")}{(data.member.users?.last_name?.[0] ?? "")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{data.member.users?.first_name} {data.member.users?.last_name}</p>
            <p className="text-[11px] text-muted-foreground">Readiness Status</p>
          </div>
          {(() => {
            const hasReq = data.data.readingMissing.length > 0;
            const hasProf = data.data.profileMissing.length > 0;
            const ok = !hasReq && !hasProf;
            return (
              <Badge className={`text-[9px] ${ok ? "bg-green-500/15 text-green-600" : hasReq ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600"}`}>
                {ok ? "All Clear" : hasReq ? "Action Required" : "Incomplete"}
              </Badge>
            );
          })()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* Required Reading */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold">Required Reading</h3>
            </div>
            {data.data.readingMissing.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/5 border border-green-500/20 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-green-600">All required documents read</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {data.data.readingMissing.map((doc: { id: string; title: string }) => (
                  <div key={doc.id} className="flex items-center gap-2 rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2">
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-xs truncate">{doc.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profile Completeness */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Profile Completeness</h3>
            </div>
            {data.data.profileMissing.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/5 border border-green-500/20 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-green-600">Profile complete</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {data.data.profileMissing.map((field: string) => (
                  <div key={field} className="flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                    <AlertOctagon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs">{field}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Close */}
        <div className="border-t border-border/40 px-5 py-3 shrink-0">
          <Button size="sm" variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
