"use client";

/**
 * Sparkline - tiny one-line inline trend, for KPI tiles.
 */

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  ariaLabel?: string;
}

export function Sparkline({
  data,
  color = "currentColor",
  width = 60,
  height = 16,
  ariaLabel = "Sparkline",
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <span
        className="inline-block text-[9px] text-muted-foreground"
        style={{ width, height }}
        aria-label={ariaLabel}
      >
        -
      </span>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data
    .map((v, i) => {
      const x = data.length === 1 ? width / 2 : i * stepX;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
      width={width}
      height={height}
      preserveAspectRatio="none"
      aria-label={ariaLabel}
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
