"use client";

/**
 * StackedBarChart - vertical stacked bars (one bar per X-axis bucket, multiple
 * series stacked within each bar). Inline SVG, semantic colors.
 */

interface Series {
  name: string;
  color: string;
  /** One value per bucket; arrays must all match buckets.length. */
  values: number[];
}

interface StackedBarChartProps {
  buckets: string[];
  series: Series[];
  height?: number;
  showLegend?: boolean;
  ariaLabel?: string;
}

export function StackedBarChart({
  buckets,
  series,
  height = 120,
  showLegend = true,
  ariaLabel = "Stacked bar chart",
}: StackedBarChartProps) {
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

  // Per-bucket total to compute max.
  const totals = buckets.map((_, i) =>
    series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0),
  );
  const max = Math.max(...totals, 1);
  const barWidth = (width / buckets.length) * 0.7;
  const barGap = (width / buckets.length) * 0.3;

  return (
    <div className="w-full" aria-label={ariaLabel}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        {buckets.map((_, i) => {
          let stackOffset = 0;
          return series.map((ser, j) => {
            const v = ser.values[i] ?? 0;
            const h = (v / max) * usable;
            const y = usable - stackOffset - h;
            stackOffset += h;
            return (
              <rect
                key={`${i}-${j}`}
                x={i * (barWidth + barGap) + barGap / 2}
                y={y}
                width={barWidth}
                height={h}
                fill={ser.color}
                rx={0.5}
              />
            );
          });
        })}
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
