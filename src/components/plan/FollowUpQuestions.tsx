"use client";

import { useState } from "react";
import type { FollowUp } from "@/lib/plan/followUps";

/** Questions asked before planning (when? who?), answered with a tap; the day is planned once all are. */
export function FollowUpQuestions({ questions, disabled, onDone, onSkip }: {
  questions: FollowUp[];
  disabled: boolean;
  /** Every answer, in the order asked. */
  onDone: (answers: string[]) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  function pick(id: string, answer: string) {
    const next = { ...answers, [id]: answer };
    setAnswers(next);
    if (questions.every((q) => next[q.id])) onDone(questions.map((q) => next[q.id]));
  }
  return (
    <div className="mt-3 space-y-3">
      {questions.map((q) => (
        <fieldset key={q.id}>
          <legend className="mb-1.5 text-xs font-semibold">{q.question}</legend>
          <div className="flex flex-wrap gap-1.5">
            {q.choices.map((c) => (
              <button
                key={c.label}
                type="button"
                aria-pressed={answers[q.id] === c.answer}
                disabled={disabled}
                onClick={() => pick(q.id, c.answer)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-brand aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-on-color"
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="button" disabled={disabled} onClick={onSkip} className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-brand">
        Skip, just plan it
      </button>
    </div>
  );
}
