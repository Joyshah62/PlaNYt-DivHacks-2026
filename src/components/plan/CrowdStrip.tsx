import { clock } from "@/lib/plan/time";

/**
 * Hour-by-hour area busyness for the day, with the planned visit in red and the
 * rest faded, so "why this time?" is answered at a glance.
 */
export function CrowdStrip({
  levels,
  visitStart,
  visitEnd,
  fromHour,
  toHour,
  className,
}: {
  levels: number[];
  visitStart: number;
  visitEnd: number;
  fromHour: number;
  toHour: number;
  className?: string;
}) {
  const hours = Array.from({ length: Math.max(1, toHour - fromHour) }, (_, i) => fromHour + i);
  const inVisit = (hr: number) => hr * 60 < visitEnd && (hr + 1) * 60 > visitStart;
  // One description for screen readers in place of the bars.
  const peak = hours.reduce((a, b) => ((levels[b % 24] ?? 0) > (levels[a % 24] ?? 0) ? b : a));
  const low = hours.reduce((a, b) => ((levels[b % 24] ?? 0) < (levels[a % 24] ?? 0) ? b : a));
  const label = `Area busyness by hour, ${clock(fromHour * 60)} to ${clock(toHour * 60)}: busiest around ${clock(peak * 60)}, quietest around ${clock(low * 60)}. ${
    visitEnd > visitStart ? `The visit, ${clock(visitStart)} to ${clock(visitEnd)}, is shown in red.` : ""
  }`;
  return (
    <div className={className} role="img" aria-label={label}>
      <div className="pl-bars" aria-hidden>
        {hours.map((hr) => {
          const level = levels[hr % 24] ?? 0;
          return <span key={hr} title={`${clock(hr * 60)}: ${Math.round(level * 100)}% of the day's busiest hour`} className={inVisit(hr) ? "on" : undefined} style={{ height: `${Math.max(8, level * 100)}%` }} />;
        })}
      </div>
      <div className="pl-bars-axis pl-mono" aria-hidden>
        <span>{clock(fromHour * 60)}</span>
        <span>{clock(Math.round((fromHour + toHour) / 2) * 60)}</span>
        <span>{clock(toHour * 60)}</span>
      </div>
    </div>
  );
}
