"use client";

/**
 * HeatCalendar - GitHub-style activity grid. One cell per day for the last N
 * weeks. Color intensity scales with the day's value.
 */

interface HeatCalendarProps {
  /**
   * Map of ISO date (YYYY-MM-DD) -> count for that day. Missing days render
   * as zero (lowest intensity).
   */
  counts: Record<string, number>;
  /** How many full weeks to render (default 12). */
  weeks?: number;
  /** Hex base color for max-intensity cells; lower values are tinted toward neutral. */
  color?: string;
  ariaLabel?: string;
}

function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

export function HeatCalendar({
  counts,
  weeks = 12,
  color = "#6366f1",
  ariaLabel = "Activity heat calendar",
}: HeatCalendarProps) {
  const totalDays = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start at the Sunday `weeks-1` weeks before today's week-start.
  const start = new Date(today);
  start.setDate(start.getDate() - (totalDays - 1));

  const days: Array<{ date: string; value: number }> = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = toIsoDay(d);
    days.push({ date: iso, value: counts[iso] ?? 0 });
  }

  const max = Math.max(...days.map((d) => d.value), 1);
  const [r, g, b] = hexToRgb(color);

  const cell = 12;
  const gap = 2;
  const cols = weeks;
  const rows = 7;

  return (
    <div className="w-full overflow-x-auto" aria-label={ariaLabel}>
      <svg
        width={cols * (cell + gap)}
        height={rows * (cell + gap)}
        role="img"
      >
        {days.map((d, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          const intensity = d.value / max;
          // Blend cell color toward the brand color based on intensity.
          const alpha = 0.08 + intensity * 0.92;
          const fill = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          return (
            <rect
              key={d.date}
              x={col * (cell + gap)}
              y={row * (cell + gap)}
              width={cell}
              height={cell}
              fill={fill}
              rx={2}
            >
              <title>
                {d.date}: {d.value}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
