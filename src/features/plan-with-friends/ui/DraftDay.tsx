import { CROWD_COLOR, CROWD_LABEL, isMealBreak, LEG_VERB } from "../bridge/index";
import { PlaceThumb } from "./PlaceThumb";
import { clock, duration } from "../bridge/index";
import type { DayPlan } from "../bridge/index";

export function DraftDay({
  plan,
  updating,
  error,
  locked,
  whoMisses,
}: {
  plan: DayPlan | null;
  updating: boolean;
  error: string | null;
  locked: boolean;
  /** Avatars of people who aren't free for a stop's time. */
  whoMisses?: (start: number, end: number) => string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" aria-busy={updating}>
      <h2 className="text-sm font-semibold">{locked ? "Final day" : "Draft day"}</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {locked ? "Locked. Open it in the planner to fine-tune, save or export." : updating ? "Updating…" : "Updates as votes change."}
      </p>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      {!plan ? (
        <p className="text-sm text-muted-foreground">Vote for a place to start the day.</p>
      ) : (
        <ol className="flex flex-col">
          {plan.stops.map((s) => (
            <li key={s.key} className="grid grid-cols-[4.5rem_1fr] gap-2">
              <span className="pt-0.5 text-sm font-semibold tabular-nums">{clock(s.startMin)}</span>
              <div className="border-l-2 border-brand pb-3 pl-3">
                {s.leg && (
                  <p className="text-xs text-muted-foreground">
                    {duration(s.leg.minutes)} {LEG_VERB[s.leg.mode]}
                  </p>
                )}
                <div className="flex items-center gap-2.5">
                  {!isMealBreak(s) && <PlaceThumb stop={s} className="size-9 rounded-lg" />}
                  <p className="text-sm font-semibold">{s.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {whoMisses && whoMisses(s.startMin, s.endMin).length > 0 && (
                    <span className="mr-1.5 text-amber-600 dark:text-amber-400">{whoMisses(s.startMin, s.endMin).join(" ")} can&apos;t make this ·</span>
                  )}
                  {duration(s.endMin - s.startMin)}
                  {s.crowd && (
                    <>
                      {" · "}
                      <span style={{ color: CROWD_COLOR[s.crowd.band] }} className="font-semibold">
                        {CROWD_LABEL[s.crowd.band]}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {plan && plan.skipped.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Left out: {plan.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}</p>
      )}
    </div>
  );
}
