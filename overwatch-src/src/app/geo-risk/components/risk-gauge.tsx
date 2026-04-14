"use client";

export function RiskGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180;
  const rad = ((180 - angle) * Math.PI) / 180;
  const color =
    score >= 75 ? "#ef4444" : score >= 50 ? "#f59e0b" : score >= 25 ? "#3b82f6" : "#22c55e";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-44 h-[90px]">
        <svg viewBox="0 0 200 105" className="w-full h-full">
          <path d="M 10 95 A 90 90 0 0 1 190 95" fill="none" stroke="currentColor" strokeWidth="8" className="text-border/30" />
          <path d="M 10 95 A 90 90 0 0 1 190 95" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${(score / 100) * 283} 283`} strokeLinecap="round" />
          <line x1="100" y1="95" x2={100 + 65 * Math.cos(rad)}
            y2={95 - 65 * Math.sin(rad)}
            stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="95" r="5" fill={color} />
        </svg>
      </div>
      <p className="text-3xl font-bold font-mono" style={{ color }}>{score}</p>
      <p className="text-[10px] text-muted-foreground -mt-1">Risk Score</p>
    </div>
  );
}
