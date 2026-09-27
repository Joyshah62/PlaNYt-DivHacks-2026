import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A section folded to one ruled line (a kicker, a title and what's inside, in brief) that opens
 * in place. Keeps the column short: the day comes first, the extras when asked for.
 */
/** Which folds the reader opened, by kicker: a re-plan can unmount a fold, and it should come back as it was. */
const opened = new Map<string, boolean>();

export function Fold({ kicker, title, summary, defaultOpen = false, children }: { kicker: string; title: ReactNode; summary?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="pl-fold" open={opened.get(kicker) ?? defaultOpen} onToggle={(e) => opened.set(kicker, e.currentTarget.open)}>
      <summary>
        <span className="pl-fold-head">
          <span className="pl-mono pl-kicker">{kicker}</span>
          <span className="pl-fold-title">{title}</span>
          {summary && <span className="pl-fold-sum">{summary}</span>}
        </span>
        <ChevronDown aria-hidden />
      </summary>
      <div className="pl-fold-body">{children}</div>
    </details>
  );
}
