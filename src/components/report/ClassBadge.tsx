"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CLASS_INFO } from "@/lib/severity";
import type { ViolationClass } from "@/lib/nyc/types";

/**
 * A class never appears without its plain-English meaning. The label is visible
 * text, not only a tooltip - hover is an enhancement, never the only explanation.
 */
export function ClassBadge({ violationClass }: { violationClass: ViolationClass }) {
  const info = CLASS_INFO[violationClass];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={`inline-flex cursor-help items-center gap-1.5 rounded-full ${info.soft} px-2.5 py-1 text-xs font-medium ${info.text}`}
          />
        }
      >
        <span className={`size-1.5 rounded-full ${info.accent}`} />
        Class {violationClass} &middot; {info.label}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty leading-relaxed">
        {info.blurb}
      </TooltipContent>
    </Tooltip>
  );
}
