"use client";

/**
 * GroupedBarChart - vertical grouped bars (one cluster per X-axis bucket,
 * multiple series side-by-side within each cluster). Inline SVG.
 */

interface Series {
  name: string;
  color: string;
  values: number[];
}

interface GroupedBarChartProps {
  buckets: string[];
  series: Series[];
  height?: number;
  showLegend?: boolean;
  ariaLabel?: string;
}

export function GroupedBarChart({
  buckets,
  series,
  height = 120,
  showLegend = true,
  ariaLabel = "Grouped bar chart",
}: GroupedBarChartProps) {
  const width = 100;
  const usable = height - 20;

  if (buckets.length === 0 || series.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-muted-foreground"
        style={{ height }}
        aria-label={ariaLabel}
      >
        no data
      </div>
    );
  }

  const max = Math.max(
    ...series.flatMap((s) => s.values),
    1,
  );

  const clusterWidth = width / buckets.length;
  const clusterPad = clusterWidth * 0.15;
  const innerWidth = clusterWidth - clusterPad * 2;
  const barWidth = innerWidth / series.length;

  return (
    <div className="w-full" aria-label={ariaLabel}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        {buckets.map((_, i) =>
          series.map((ser, j) => {
            const v = ser.values[i] ?? 0;
            const h = (v / max) * usable;
            return (
              <rect
                key={`${i}-${j}`}
                x={i * clusterWidth + clusterPad + j * barWidth}
                y={usable - h}
                width={barWidth - 0.4}
                height={h}
                fill={ser.color}
                rx={0.5}
              />
            );
          }),
        )}
      </svg>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1" aria-hidden="true">
        {buckets.map((b, i) => (
          <span key={i}>{b}</span>
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-3 mt-2 text-[10px]">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
