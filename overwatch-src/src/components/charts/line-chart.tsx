"use client";

/**
 * LineChart - small inline-SVG trend line.
 *
 * Mirrors the visual conventions of MiniBarChart / DonutChart in
 * feed/components/shared.tsx. No external chart library.
 *
 * Inputs:
 *   data       - numeric series, equally spaced along the X-axis.
 *   color      - CSS color (use semantic Tailwind tokens or HSL strings).
 *   labels     - optional X-axis labels rendered below the chart.
 *   showDots   - render endpoint dots.
 *   smoothing  - 0 (polyline) or 1 (basic curve).
 */

interface LineChartProps {
  data: number[];
  color?: string;
  labels?: string[];
  showDots?: boolean;
  smoothing?: 0 | 1;
  width?: number;
  height?: number;
  ariaLabel?: string;
}

export function LineChart({
  data,
  color = "currentColor",
  labels,
  showDots = false,
  smoothing = 0,
  width = 100,
  height = 40,
  ariaLabel = "Trend chart",
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-muted-foreground"
        style={{ width: "100%", height }}
        aria-label={ariaLabel}
      >
        no data
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((v, i) => {
    const x = data.length === 1 ? width / 2 : i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return { x, y };
  });

  const pathD =
    smoothing === 0
      ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")
      : (() => {
          // Lightweight Catmull-Rom-ish smoothing.
          const out: string[] = [`M ${points[0].x} ${points[0].y}`];
          for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            const cx = (p0.x + p1.x) / 2;
            out.push(`C ${cx} ${p0.y} ${cx} ${p1.y} ${p1.x} ${p1.y}`);
          }
          return out.join(" ");
        })();

  return (
    <div className="w-full" aria-label={ariaLabel}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {showDots && (
          <>
            <circle cx={points[0].x} cy={points[0].y} r={1.5} fill={color} />
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={2}
              fill={color}
            />
          </>
        )}
      </svg>
      {labels && labels.length > 0 && (
        <div
          className="flex justify-between text-[9px] text-muted-foreground mt-1"
          aria-hidden="true"
        >
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
