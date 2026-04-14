"use client";

import { Card, CardContent } from "@/components/ui/card";

function RadialGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-border/30" />
          <circle cx="48" cy="48" r="40" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold font-mono">{value}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

interface ReadinessGaugesProps {
  owProgress: number;
  quizCount: number;
  certPercent: number;
}

export default function ReadinessGauges({ owProgress, quizCount, certPercent }: ReadinessGaugesProps) {
  return (
    <Card className="border-border/40 bg-gradient-to-br from-card to-card/80">
      <CardContent className="py-6">
        <div className="flex items-center justify-around">
          <RadialGauge value={owProgress} label="Module Progress" color="#3b82f6" />
          <RadialGauge value={quizCount > 0 ? Math.min(quizCount * 25, 100) : 0} label="Drill Readiness" color="#f59e0b" />
          <RadialGauge value={certPercent} label="Certs Current" color="#10b981" />
        </div>
      </CardContent>
    </Card>
  );
}
