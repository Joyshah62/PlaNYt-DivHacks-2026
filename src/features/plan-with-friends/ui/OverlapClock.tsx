import { clock } from "../bridge/index";
import type { FreeWindow, GroupWindow } from "../core/availability";
import { AVATAR_HEX, type Avatar } from "../core/avatars";

export interface ClockPerson {
  id: string;
  name: string;
  avatar: Avatar;
  free: FreeWindow | null;
}

const DAY = 24 * 60;
const MAX_RINGS = 5;

function polar(cx: number, cy: number, r: number, minutes: number) {
  const a = ((minutes % DAY) / DAY) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > DAY / 2 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

function wedge(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > DAY / 2 ? 1 : 0;
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y} Z`;
}

/** Everyone's free time on a 24-hour dial (or stacked bars when there are many people), with the overlap lit up. */
export function OverlapClock({ people, group }: { people: ClockPerson[]; group: GroupWindow | null }) {
  const set = people.filter((p) => p.free);
  if (!set.length) return null;

  if (set.length > MAX_RINGS) {
    const lo = Math.min(...set.map((p) => p.free!.from), group?.from ?? Infinity);
    const hi = Math.max(...set.map((p) => p.free!.to), group?.to ?? -Infinity);
    const pct = (m: number) => ((m - lo) / (hi - lo)) * 100;
    return (
      <div className="relative mt-3 flex flex-col gap-1.5" aria-label="Everyone's free time">
        {group && <div className="absolute inset-y-0 rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/50" style={{ left: `calc(1.75rem + (100% - 1.75rem) * ${pct(group.from) / 100})`, width: `calc((100% - 1.75rem) * ${(pct(group.to) - pct(group.from)) / 100})` }} />}
        {set.map((p) => (
          <div key={p.id} className="relative flex items-center gap-1.5">
            <span className="w-6 text-center text-sm" title={p.name}>
              {p.avatar.emoji}
            </span>
            <div className="relative h-2 flex-1 rounded-full bg-muted">
              <div className="absolute inset-y-0 rounded-full" style={{ left: `${pct(p.free!.from)}%`, width: `${pct(p.free!.to) - pct(p.free!.from)}%`, background: AVATAR_HEX[p.avatar.color] }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const size = 200;
  const c = size / 2;
  const outer = 86;
  const gap = 12;
  return (
    <svg viewBox={`-18 -18 ${size + 36} ${size + 36}`} className="mx-auto mt-3 block w-full max-w-[190px]" role="img" aria-label="Everyone's free time on a clock">
      <circle cx={c} cy={c} r={outer + 6} className="fill-none stroke-border" strokeWidth={1} />
      {group && <path d={wedge(c, c, outer + 6, group.from, group.to)} className={group.everyone ? "fill-emerald-500/20" : "fill-amber-500/15"} />}
      {[0, 6, 12, 18].map((h) => {
        const p = polar(c, c, outer + 14, h * 60);
        return (
          <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[8px]">
            {h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}
          </text>
        );
      })}
      {set.map((p, i) => {
        const r = outer - i * gap;
        const end = polar(c, c, r, p.free!.to);
        return (
          <g key={p.id}>
            <circle cx={c} cy={c} r={r} className="fill-none stroke-muted" strokeWidth={6} />
            <path d={arc(c, c, r, p.free!.from, p.free!.to)} fill="none" stroke={AVATAR_HEX[p.avatar.color]} strokeWidth={6} strokeLinecap="round" />
            <text x={end.x} y={end.y} textAnchor="middle" dominantBaseline="central" className="text-[10px]">
              <title>{p.name}</title>
              {p.avatar.emoji}
            </text>
          </g>
        );
      })}
      {group && (
        <text x={c} y={c} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[10px] font-semibold">
          {clock(group.from)}–{clock(group.to)}
        </text>
      )}
    </svg>
  );
}
