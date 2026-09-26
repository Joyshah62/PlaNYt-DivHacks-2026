import { crowdBand } from "@/lib/plan/crowd";
import { CROWD_COLOR } from "@/lib/plan/display";
import { clock } from "@/lib/plan/time";
import { cn } from "@/lib/utils";

/**
 * Hour-by-hour area busyness for the day, with the planned visit lit up and the
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
  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-9 items-end gap-[2px]" aria-hidden>
        {hours.map((hr) => {
          const level = levels[hr % 24] ?? 0;
          return (
            <span
              key={hr}
              title={`${clock(hr * 60)}: ${Math.round(level * 100)}% of the day's busiest hour`}
              className={cn("flex-1 rounded-[3px] transition-opacity", inVisit(hr) ? "opacity-100" : "opacity-25")}
              style={{ height: `${Math.max(8, level * 100)}%`, background: CROWD_COLOR[crowdBand(level)] }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums" aria-hidden>
        <span>{clock(fromHour * 60)}</span>
        <span>{clock(Math.round((fromHour + toHour) / 2) * 60)}</span>
        <span>{clock(toHour * 60)}</span>
      </div>
    </div>
  );
}
