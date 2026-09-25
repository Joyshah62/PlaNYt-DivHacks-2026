import { CircleAlert, RefreshCw } from "lucide-react";

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-xl">
        <p className="text-xs font-semibold tracking-widest text-brand uppercase">{eyebrow}</p>
        <h2 id={id} className="mt-2 font-display text-3xl tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** A designed failure: what didn't load, and a way to try again. Never a zero. */
export function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-6 sm:flex-row sm:items-center">
      <CircleAlert className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition hover:border-foreground/30 sm:ml-auto"
        >
          <RefreshCw className="size-3.5" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}
