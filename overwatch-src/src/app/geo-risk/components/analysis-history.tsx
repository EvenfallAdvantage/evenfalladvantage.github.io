"use client";

import { MapPin, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RISK_COLORS } from "@/lib/geo-risk-data";
import type { RiskResult } from "./shared";

type Props = {
  history: RiskResult[];
  onSelect: (result: RiskResult) => void;
};

export function AnalysisHistory({ history, onSelect }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground">Recent Analyses</h3>
      {history.map((h, i) => {
        const hc = RISK_COLORS[h.overallRating];
        return (
          <Card key={i} className="border-border/40 cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => onSelect(h)}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">{h.city}, {h.state}</span>
                <Badge className={`text-[9px] ${hc.bg} ${hc.text}`}>{h.overallRating}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold">{h.riskScore}</span>
                <BarChart3 className="h-3 w-3 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
