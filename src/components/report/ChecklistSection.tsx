"use client";

import { useState } from "react";
import { Check, Copy, Plus, Printer, Trash2, X } from "lucide-react";
import { useChecklist } from "@/lib/checklist";

export function ChecklistSection({ address }: { address: string }) {
  const checklist = useChecklist();
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = checklist.asText(`Viewing checklist — ${address}`);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the textarea below still holds the notes
      // and the print view offers a second route out.
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="p-5">
        {checklist.items.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">
            Your checklist is empty. Add items from the findings above, or write
            your own below.
          </p>
        ) : (
          <ul className="space-y-1">
            {checklist.items.map((item) => (
              <li key={item.id} className="group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-accent/50">
                <input
                  type="checkbox"
                  id={`check-${item.id}`}
                  checked={item.checked}
                  onChange={() => checklist.toggle(item.id)}
                  className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
                />
                <label
                  htmlFor={`check-${item.id}`}
                  className={`flex-1 text-[15px] leading-relaxed ${
                    item.checked ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {item.text}
                  {item.kind === "observation" && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground print:hidden">
                      look for this
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => checklist.remove(item.id)}
                  aria-label={`Remove: ${item.text}`}
                  className="rounded-full p-1 text-muted-foreground opacity-0 transition hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100 print:hidden"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            checklist.addCustom(draft.trim());
            setDraft("");
          }}
          className="mt-4 flex gap-2 print:hidden"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add your own question or thing to check"
            aria-label="Add your own checklist item"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm transition hover:bg-accent"
          >
            <Plus className="size-3.5" aria-hidden /> Add
          </button>
        </form>

        <div className="mt-5">
          <label
            htmlFor="checklist-notes"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Notes from the viewing
          </label>
          <textarea
            id="checklist-notes"
            value={checklist.notes}
            onChange={(e) => checklist.setNotes(e.target.value)}
            rows={3}
            placeholder="What you were told, what you saw…"
            className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4 print:hidden">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm transition hover:bg-accent"
        >
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden /> Copy checklist
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm transition hover:bg-accent"
        >
          <Printer className="size-3.5" aria-hidden /> Print
        </button>
        <button
          type="button"
          onClick={() => checklist.clear()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition hover:bg-accent"
        >
          <Trash2 className="size-3.5" aria-hidden /> Clear checklist
        </button>

        <p className="ml-auto text-xs text-muted-foreground" role="status">
          {checklist.persisted
            ? "Saved on this device only. It is not sent anywhere."
            : "Could not be saved on this device — it will be lost when you close this tab."}
        </p>
      </div>
    </div>
  );
}
