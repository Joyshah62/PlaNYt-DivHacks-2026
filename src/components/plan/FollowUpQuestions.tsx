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
  // The planner's own chips (planner.css), so the answers read as buttons in its editorial theme.
  return (
    <div className="mt-3 grid gap-3">
      {questions.map((q) => (
        <fieldset key={q.id}>
          <legend className="pl-mono pl-kicker mb-2">{q.question}</legend>
          <div className="pl-chips" role="group" aria-label={q.question}>
            {q.choices.map((c) => (
              <button key={c.label} type="button" aria-pressed={answers[q.id] === c.answer} disabled={disabled} onClick={() => pick(q.id, c.answer)} className="pl-chip">
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="button" disabled={disabled} onClick={onSkip} className="pl-link w-fit">
        Skip, just plan it
      </button>
    </div>
  );
}
